# Box 2 Box: Monetisation Plan

_Drafted September 2026. Prices are in GBP unless stated. Infrastructure prices are USD list prices as of September 2026._

## 1. Summary

**Keep the app free for athletes. Make most of the money from the businesses that want to reach them.** Instagram, Strava and Meetup all work this way. The audience is the asset, and the people who pay are the ones who want access to that audience.

Five ways to make money, in the order we should turn them on:

| # | Revenue stream | Who pays | Starts | Year-2 potential* |
|---|---|---|---|---|
| 1 | **Affiliate Gym Pro** (claimed and upgraded gym pages) | Gym owners | Q1 2027 pilot | £25k–£60k |
| 2 | **Event partnerships** (featured events, organiser tools, ticket referral fees) | Event organisers, ticket platforms | Q1 2027 | £15k–£40k |
| 3 | **Brand partnerships and sponsored challenges** | Apparel, supplement, equipment and nutrition brands | Q2 2027 | £20k–£80k |
| 4 | **Box 2 Box Pro** (optional premium tier for athletes, only for high-value extras) | Athletes | Q3 2027 | £15k–£50k |
| 5 | **Marketplace** (drop-in bookings, coach programming) and, later, native ads | Gyms, coaches, advertisers | 2028+ | Upside |

\*These are illustrative ranges at about 15k–30k monthly active UK athletes. The assumptions are in section 8. They are not forecasts.

**On storage costs:** storage will not get expensive if we fix *how* we store media now, before growth. At the moment it would. The fix is an engineering job, not a pricing one (section 3). A premium tier should not be "pay for unlimited uploads". It should be "pay for longer videos, full quality and a private training-video vault". That keeps posting free, which is what drives growth, and it charges for something athletes actually value (section 5).

---

## 2. What we have to sell

Things the app already has that are worth money:

- **A niche, high-intent, high-spend audience.** CrossFit athletes spend heavily on memberships, kit, supplements, competitions and travel. Brands struggle to reach them precisely on the big platforms.
- **Location data by consent.** Athlete `area` and gym and event locations are geocoded, so we can target by distance ("athletes within 25 miles of your box").
- **Affiliation data.** We know which box each athlete trains at. That gives us gym-level community insight that no other platform has.
- **Event intent.** Participate, Interested, Pin and the find-a-teammate alerts are strong buying signals for event organisers and ticket platforms.
- **Performance data.** PBs and workout logs are the natural hook for sponsored challenges and leaderboards.
- **Gym and event directories with a submission and moderation flow already built.** "Claim and upgrade your listing" follows directly from this.

---

## 3. Storage: the cost risk and how to remove it

### How media works today (from `src/lib/uploads.ts` and `src/app/media/[filename]/route.ts`)

- Photos (up to 5 MB) and videos (up to 15 s, up to 150 MB) are saved **byte-for-byte as uploaded** to a Railway persistent volume.
- There is **no compression, resizing or transcoding**. A 15-second iPhone 4K clip can be 30–45 MB.
- Every view is served by the Next.js app itself. The server reads the **whole file into memory**, with no CDN and no HTTP range requests. The missing range support can also make video playback unreliable in iOS Safari.
- We pay for this twice: **volume storage at $0.15/GB-month** and **egress at $0.05/GB** every time someone views a file.

### What that costs as we grow

Assumptions: 10,000 active users, each posting about 8 photos and 3 videos a month, each item viewed about 40 times.

| | Today (raw files, Railway volume) | Optimised (compressed, object storage and CDN) |
|---|---|---|
| Average photo | ~2.5 MB | ~0.25 MB (WebP, max 1600 px) |
| Average 15 s video | ~30 MB | ~5 MB (720p H.264/HEVC) |
| New media per month | ~1.1 TB | ~0.17 TB |
| Stored after 12 months | ~13 TB, **≈ $2,000/month** | ~2 TB, **≈ $30/month** |
| Egress per month | ~44 TB, **≈ $2,200/month** | **$0** (R2 or Railway Buckets have free egress) |
| **Total at month 12** | **≈ $4,000+/month and rising** | **≈ $30–$150/month** (including transcoding compute) |

After optimisation, an active user costs **well under 1p a month** in storage. That changes the premium question. We don't need a tier just to cover storage. We can afford to make posting free and generous.

### Storage roadmap (do this first: Q4 2026)

> **Status (Sept 2026):** items 1 and 2 are built, plus the orphan cleanup from item 4. See `docs/media-storage.md` for the Railway bucket setup. Items 3 (per-user byte tracking) and 5 (cost alert) are still to do.

1. **Move media to object storage with free egress.** Use Cloudflare R2 ($0.015/GB-month) or Railway Storage Buckets (also $0.015/GB-month). Both have free egress. Serve media from a CDN URL, not through the app server.
2. **Compress on upload.** Resize photos and convert to WebP. Transcode videos to 720p with a background `ffmpeg` worker. Delete the original, or move it to cheaper infrequent-access storage ($0.01/GB-month) if Pro needs it.
3. **Record file sizes.** Add `bytes` and `storageKey` to each media record so we can measure per-user storage and set quotas later.
4. **Lifecycle rules.** Delete orphaned files, such as media from deleted posts or replaced profile photos. Consider moving media older than 12 months to infrequent-access storage.
5. **Set a cost alert.** Alert if media spend per monthly active user goes above 2p.

We should self-host transcoding rather than use a managed video service. Services like Cloudflare Stream or Mux charge per minute stored and delivered, which would cost roughly 10–20× more at our scale.

---

## 4. Target customers

### Paying businesses (B2B: most of the revenue)

| Segment | Size (UK) | What they want | What we sell them |
|---|---|---|---|
| **Affiliate gym owners** | ~500+ UK affiliates | New members, drop-ins, and keeping current members engaged | Affiliate Gym Pro |
| **Event and competition organisers** | Hundreds of events a year, from local throwdowns to multi-day comps | Fill their divisions (especially team events), and reach athletes by level and distance | Featured events, organiser tools |
| **Ticketing and competition platforms** | Competition Corner, Compete-Zone and similar | Registrations | Referral fees, API partnerships |
| **Fitness brands** | Apparel, supplements, equipment, wearables, nutrition, physio and recovery | Authentic reach into a high-spend niche | Sponsored challenges, native partnerships, discount hub |
| **Coaches and programmers** | Thousands of independent coaches | Selling programming and remote coaching | Marketplace (later) |

### Athletes (the free users, and a small share who choose Pro)

| Persona | Share (guess) | Motivation | Would pay for |
|---|---|---|---|
| **The Competitor** | ~15% | PBs, events, finding teammates | Training vault, PB analytics, long and full-quality video, form comparison |
| **The Social Athlete** | ~50% | Community and friends beyond their box | Probably nothing. Keep it free. Their activity is what brands pay for. |
| **The Traveller** | ~15% | Drop-ins when away | Discounted or instant drop-in booking (marketplace) |
| **The Coach** | ~5% | Showing off athletes, winning clients | Pro, then marketplace seller tools |
| **"Something deeper"** (singles) | ~15% | Meeting like-minded people | Possibly premium social features (see 5.3, handle carefully) |

---

## 5. The revenue streams in detail

### 5.1 Affiliate Gym Pro (primary B2B product)

Gym pages already exist (`Gym` model, Discover → Affiliates). Let owners **claim** their page for free, then upgrade.

| Tier | Price | Includes |
|---|---|---|
| **Claimed** | Free | Verified badge, edit description, photos, address and website, reply as the gym |
| **Gym Pro** | £29/month or £290/year | Featured placement in Discover for athletes within X miles; class timetable; drop-in info and "book a drop-in" button; announcements pushed to members and followers; gym-hosted events at the top of the event list; member leaderboards and box challenges; basic insights (views, followers, member count, drop-in clicks) |
| **Gym Pro+** | £59/month | Everything in Pro, plus recruitment campaigns ("new to CrossFit near you"), advanced insights (member activity, retention signals), multiple admin logins, and a Wodify/TeamUp integration (the `connectedPlatform` field is already reserved for this) |

- **Why gyms pay:** one new member is worth about £100–£150/month to a box. The product pays for itself if it brings in **one member a year**.
- **Go-to-market:** gyms whose members are already active on the app get an email: "37 of your members are on Box 2 Box. Claim your page." Offer a 3-month free pilot to 10–20 founding gyms in exchange for testimonials.
- **Target:** 10% of UK affiliates on Pro within 18 months of launch (about 50 gyms, about £17k ARR). 25% in year 3.

### 5.2 Event partnerships

| Product | Price | Notes |
|---|---|---|
| **Featured event** | £25–£150 per event (by reach and duration) | Top of Discover, Events and "near you" lists, clearly labelled "Featured" |
| **Organiser toolkit** | £49–£199 per event, or £39/month for organisers who run several events | Official verified page; announcements to everyone who marked Participate, Interested or Pin; a promoted "find a teammate" drive to fill team divisions; registration click-through stats |
| **Ticket referral fees** | Revenue share or flat fee per registration | Partner with ticketing and competition platforms (the `source` field already expects aggregator feeds). Tracked links on the event's `websiteUrl`. |

- **Unique angle:** the **teammate finder**. Team divisions are the hardest thing for organisers to fill, and we can sell "we'll help fill your team division".
- **Target:** 30 paid events in 2027, 150+ in 2028.

### 5.3 Brand partnerships and sponsored challenges

This is the Instagram-style indirect revenue, adapted for a small, engaged community. It should feel native, not like banner ads.

- **Sponsored challenges** (£2k–£10k per campaign). For example, "The [Brand] 30-Day Row Challenge", with a leaderboard built from workout logs and a branded badge on profiles. This fits naturally with PBs and workouts.
- **Partner discount hub** (free to list; we earn 5–15% affiliate commission). A "Perks" tab with member-only codes for kit, supplements and physio. It also adds value to the free tier.
- **Sponsored posts** in the feed, clearly marked "Sponsored" and capped at 1 in 15–20 posts. Only after 25k+ monthly active users. Below that, the income won't be worth the damage to the experience.
- **Anonymised, aggregated insight reports** for brands (for example "UK CrossFit athlete trends 2027"). Only aggregated, only opt-in, and UK GDPR compliant. Never sell individual data.

**Rules to protect the community:** everything paid is labelled (the ASA/CAP code requires this); no ads in DMs or event notice boards; athletes can hide sponsored content categories.

### 5.4 Box 2 Box Pro (optional premium tier for athletes)

**Principle: the free app must never feel limited for normal use.** Posting, following, messaging, events and teammate finding all stay free. Pro is for athletes who want *more*, not a toll for the basics.

**Why not "pay for unlimited uploads":**
1. After the storage fixes, a normal user costs less than 1p a month to store, so there's no cost to recover.
2. Limiting uploads cuts content, and content is what keeps a social app alive and what brands pay for.
3. No major social platform charges for posting, so users would see it as a paywall on the basics.

**What Pro should be:** a **performance and media toolkit**. It includes the storage idea, but sold on value.

| Feature | Free | **Pro (£3.99/month or £34.99/year)** |
|---|---|---|
| Photo and video posts | Generous and effectively unlimited (fair-use limits to stop abuse, e.g. 30 uploads a day) | Same |
| Video length | 15 s (current) → consider 30 s | **Up to 3 minutes**, so a full WOD or competition heat |
| Video quality | 720p | **1080p and original-quality downloads** |
| **Training Vault** | – | **Private, unlimited library of lift and movement videos.** Tag by movement, compare clips side by side, slow-mo and frame-by-frame, share privately with a coach. This is where "unlimited storage" is genuinely worth paying for. |
| PB and workout history | Current PBs | **Charts, PR timelines, benchmark WOD history, % of 1RM calculator, export** |
| Profile | Standard | Pro badge (optional), extra themes, pinned highlights |
| Events | All features | Early alerts for new events near you; priority placement in teammate search |
| Perks hub | Standard partner discounts | Extra Pro-only discounts (brands fund these, which offsets part of the subscription) |

**What the Vault costs us:** a heavy Pro user uploading 100 compressed clips a month adds about 0.5 GB/month. After a year that's about £0.07/month in storage. We keep a fair-use policy, but the margin is very high.

**Optional later add-on: social discovery.** The app already has single status and a "maybe even something deeper" mission line, and dating features monetise very well. If explored, it should be a separate opt-in mode with 18+ age verification (the Online Safety Act applies here), strong blocking and reporting, and **no** paywall on safety features. Treat this as its own decision, not part of the first Pro launch.

**Targets:** 2–4% of monthly active users convert to Pro (typical for freemium social and fitness apps). At 20k monthly active users that's 400–800 subscribers, about £17k–£34k a year.

**Billing:** Stripe on the web. The app is currently a Next.js web app, so there's no App Store fee. If we ship native apps later, Apple and Google take 15% under their small-business programmes. Encourage web sign-up where the store rules allow.

### 5.5 Marketplace and ads (2028+)

- **Drop-in booking:** athletes book and pay for drop-ins in the app. We take 10% or a £1–£2 booking fee. This depends on Gym Pro adoption.
- **Coach programming marketplace:** coaches sell programmes and remote coaching. We take 15–20%.
- **Self-serve native ads:** only above about 50k monthly active users, and only with an ad-free feel (low frequency, context-targeted by location, level and interests, no invasive tracking).

---

## 6. Timeline

| Phase | When | Focus | Key deliverables | Gate to move on |
|---|---|---|---|---|
| **0. Foundations** | **Oct–Dec 2026** | Cut cost risk, measure everything | Object storage, compression and CDN (section 3); product analytics (monthly and daily active users, retention, posts per user); Stripe account; updated terms and privacy policy covering sponsored content and payments; "Claim your gym" flow (free) | Media cost per monthly active user < 2p; analytics live |
| **1. B2B pilots** | **Jan–Jun 2027** | Prove businesses will pay | 10–20 founding gyms on a free Gym Pro pilot, then paid; Featured events and organiser toolkit; first ticketing referral partnership; Perks hub with 5–10 affiliate brands | 5k+ monthly active users; ≥ 50% of pilot gyms convert to paid; first £1k/month revenue |
| **2. Brands and Pro** | **Jul–Dec 2027** | Diversify revenue | First 2–3 sponsored challenges; **launch Box 2 Box Pro** (Training Vault, long and HD video, PB analytics); Gym Pro+ | 15k+ monthly active users; 2%+ Pro conversion; month-3 Pro retention ≥ 70% |
| **3. Scale** | **2028** | Grow the flywheel | Drop-in bookings; coach marketplace; low-frequency sponsored feed posts (25k+ monthly active users); platform integrations (Wodify, TeamUp); explore Ireland, Europe or Australia | 25k–50k monthly active users; revenue covers running costs and one salary |
| **4. Platform** | **2029+** | Mature ads and insights | Self-serve ads; aggregated trend reports; international gym and event partners | 50k+ monthly active users |

**Why this order:** B2B revenue doesn't need a huge user base. A gym with 30 members on the app already gets value. Consumer subscriptions and ads need scale and a product people love, so they come later.

---

## 7. Metrics to track from day one

- **Growth:** monthly and daily active users, daily-to-monthly ratio (aim for > 25%), D30 retention, signups per gym
- **Content health:** posts per active user, % of users who post monthly (make sure monetisation never lowers these)
- **Cost:** media storage and egress per monthly active user; total infrastructure cost per monthly active user
- **B2B:** gyms claimed; Gym Pro conversion and churn; paid events; revenue per partner
- **Pro:** free-to-paid conversion, churn, Vault usage, and which feature drove each upgrade
- **Unit economics:** average revenue per monthly active user (blended) vs cost per monthly active user. Target ARPU > 5× cost.

---

## 8. Illustrative year-2 revenue (at about 20k monthly active UK athletes)

| Stream | Assumption | Annual |
|---|---|---|
| Gym Pro | 60 gyms × avg £35/month | ~£25k |
| Events | 120 paid events × avg £90, plus referral fees | ~£15k |
| Brand challenges and perks | 4 campaigns × £5k, plus affiliate commission | ~£25k |
| Box 2 Box Pro | 3% of 20k = 600 × £30/year net | ~£18k |
| **Total** | | **≈ £80k+** |

Compare that with optimised infrastructure at roughly £1–3k a year. The biggest variables are the number of monthly active users and gym adoption. Revisit the numbers every quarter using real data.

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Monetisation damages the community feel | Keep all core features free; label and cap sponsored content; no ads in DMs or notice boards |
| Storage and bandwidth costs grow faster than revenue | Section 3 roadmap; per-user byte tracking; cost alerts; fair-use caps |
| Gyms see us as a competitor to their own apps | Integrate with Wodify and TeamUp rather than replacing them; position as recruitment and community, not class management |
| Trademark and affiliation | "CrossFit" is a registered trademark. Don't imply official endorsement, and review branding and partner copy. Consider an official affiliate or partner programme conversation later. |
| Regulation | UK GDPR (consent for targeting, no sale of personal data); ASA/CAP rules on ad labelling; Online Safety Act duties (especially for any dating-style features and users under 18: current minimum age is 13) |
| App Store fees on native apps | Web-first billing; price native subscriptions to absorb 15% |

---

## 10. Suggested next steps (next 4–6 weeks)

1. **Approve the storage roadmap** and build it: object storage, compression, CDN, byte tracking.
2. **Add product analytics** so the growth gates above can be measured.
3. **Build the free "Claim your gym" flow** and contact 10–20 friendly gyms for the founding pilot.
4. **Draft Gym Pro and Featured Event sales one-pagers** and test pricing with 5 gym owners and 5 organisers.
5. **Run a short survey** of current athletes on the Pro feature list (Vault, long video, PB analytics, perks) to confirm demand before building it.
