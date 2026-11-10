# Box 2 Box — iPhone & Android apps

The store apps are a thin native shell (built with [Capacitor](https://capacitorjs.com))
that opens **https://box2box.social** full-screen. The app *is* the website, so:

- **Everyday changes** (features, design, fixes) go live the moment they're merged and
  Railway deploys — no new store build, no App Store review.
- **A new store build is only needed** when something native changes: the icon, the
  launch screen, the app name, a new plugin (e.g. push notifications) or a new phone
  permission.

Builds run in the cloud on [Codemagic](https://codemagic.io), from `codemagic.yaml` at the
repo root — no Mac or Xcode needed.

## What's in here

| Path | What it is |
|---|---|
| `capacitor.config.json` | App ID (`social.box2box.app`), name, the URL it loads, splash settings |
| `ios/` | The Xcode project (Swift Package Manager — no CocoaPods) |
| `android/` | The Android Studio / Gradle project |
| `assets/` | Source images for the icon and launch screen |
| `www/` | Local fallback pages: `offline.html` is shown when there's no connection |

The app adds `Box2BoxApp` to its browser user agent so the website can tell it's
running inside the store app (see `src/lib/nativeApp.ts`).

## One-time setup

### 1. Developer accounts (registered as an individual)

- **Apple Developer Program** — https://developer.apple.com/programs/enroll — $99/year.
  Sign in with your Apple ID and enrol as an *Individual*. Approval usually takes 1–2 days.
- **Google Play Console** — https://play.google.com/console/signup — $25 one-off.
  Choose a *personal* account. Google verifies your identity (ID document), which can
  take a few days. New personal accounts must run a **closed test with at least 12
  testers for 14 days** before the app can go public.

### 2. Create the app records

- **App Store Connect** (https://appstoreconnect.apple.com) → Apps → **+** → New App:
  platform iOS, name *Box 2 Box*, language English (UK), bundle ID **social.box2box.app**
  (register it first at developer.apple.com → Identifiers if it isn't offered), SKU
  `box2box`. Then copy the app's numeric **Apple ID** (App Information) into
  `APP_STORE_APPLE_ID` in `codemagic.yaml`.
- **Play Console** → Create app: name *Box 2 Box*, app, free. The package name
  `social.box2box.app` is fixed by the first upload.

### 3. Codemagic setup

1. Sign up at https://codemagic.io with GitHub and add the **CrossfitappB2B** repository.
2. **App Store Connect API key** — App Store Connect → Users and Access → Integrations →
   App Store Connect API → generate a key with *App Manager* access. In Codemagic:
   Team settings → Integrations → App Store Connect → add it with the name
   **Box 2 Box App Store Connect** (must match `codemagic.yaml`). Codemagic then creates
   the signing certificate and provisioning profile itself.
3. **Android upload keystore** — Team settings → Code signing identities → Android
   keystores → upload the keystore with reference name **box2box_upload_keystore**.
   Keep a copy of the keystore file and its passwords somewhere safe (e.g. a password
   manager) — every future Android update must be signed with it.
4. **Google Play service account** (for automatic uploads) — create a service account in
   Google Cloud, invite its email in Play Console → Users and permissions with release
   rights, then in Codemagic add an environment variable group **google_play** containing
   `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` (the JSON key, marked secret).

### 4. First builds

- **iOS:** run the *iOS → TestFlight* workflow. When it finishes the build appears in
  App Store Connect → TestFlight (processing takes ~15 minutes); add testers there.
- **Android:** Google requires the **very first** upload to be done by hand. Run the
  *Android → Google Play* workflow, download the `.aab` from the build's artifacts, and
  upload it in Play Console → Testing → Internal testing → Create release. Later builds
  upload automatically.

## Push notifications

Every in-app notification (likes, comments, follows, event invites…) and every direct
message is also sent as a push to the person's phones — see `src/lib/pushDelivery.ts`.
The app asks for permission after sign-in and registers the phone against the active
profile (`src/components/NativePush.tsx` → `/api/push/devices`). Nothing is sent until the
credentials below are set in **Railway → Variables**.

**iPhone (Apple Push Notification service)**
1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers** →
   `social.box2box.app` → tick **Push Notifications** → Save.
2. **Keys** → **+** → name it *Box 2 Box push*, tick **Apple Push Notifications service
   (APNs)** → Continue → Register → **Download** the `.p8` file (it can only be downloaded
   once — keep it safe). Note the **Key ID**, and your **Team ID** (Membership details).
3. Railway variables: `APNS_KEY` = the whole contents of the `.p8` file, `APNS_KEY_ID`,
   `APNS_TEAM_ID`.

**Android (Firebase Cloud Messaging)** — free
1. https://console.firebase.google.com → **Add project** → *Box 2 Box* (Google Analytics
   not needed).
2. Add an **Android app** with package name `social.box2box.app` → download
   **google-services.json** → either commit it as `mobile/android/app/google-services.json`
   or store it base64-encoded as `GOOGLE_SERVICES_JSON` in Codemagic's `google_play`
   group. Then run a new Android build.
3. Project settings → **Service accounts** → **Generate new private key** → Railway
   variable `FCM_SERVICE_ACCOUNT` = the downloaded JSON.

## Making native changes

Requires Node 22. From this folder:

```sh
npm ci              # install
npm run assets      # after changing anything in assets/ — regenerates every icon/splash size
npx cap sync        # after changing capacitor.config.json or adding a plugin
```

Commit the results, then run the Codemagic workflows to produce new store builds.
