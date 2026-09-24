import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updatedAt="24 September 2026">
      <LegalSection title="1. What we collect">
        <p>Information you give us directly:</p>
        <ul className="list-disc pl-5">
          <li>Account details: name, email address, password (stored as a salted hash, never in plain text).</li>
          <li>
            Profile details you choose to add: photo, bio, age, gender, general area, affiliate
            gym, CrossFit experience level, personal bests, relationship status, and what you're
            looking for on the app. Most of these are optional, and several have their own
            "show on my profile" toggle in Edit Profile — off by default.
          </li>
          <li>Content you post: workout logs, feed posts, photos and videos, event notices, comments, and direct messages.</li>
          <li>Your connections: who you follow, block, or mute, and events you mark as participating in or interested in.</li>
        </ul>
        <p>Information we generate or derive:</p>
        <ul className="list-disc pl-5">
          <li>An approximate latitude/longitude for your general area, used only to show distance to events and affiliates.</li>
          <li>Basic activity records needed for the app to work — e.g. read receipts on messages, notification history.</li>
          <li>A session cookie that keeps you signed in. We don't use advertising or tracking cookies.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How we use it">
        <p>
          To run the core features of the app: your feed, profile, messaging, event search, and
          notifications. To keep the community safe — reviewing reports and enforcing our{" "}
          <a href="/guidelines" className="text-b2b-pink underline">
            Community Guidelines
          </a>
          . To communicate with you about your account (e.g. verifying your email, password reset
          links). We don't sell your data, and we don't use it for advertising.
        </p>
      </LegalSection>

      <LegalSection title="3. Who can see what">
        <p>
          Your profile is visible to other users, or only to approved followers if you set your
          account to private in Settings. Fields with a "show on my profile" toggle (age,
          relationship status, looking-for tags) are only visible to others when you've switched
          that toggle on. Direct messages are only visible to the two people in that conversation
          (and to us, if a message is reported for review).
        </p>
      </LegalSection>

      <LegalSection title="4. Where it's stored">
        <p>
          Your data is stored on our hosting provider's infrastructure. We don't currently share
          your personal data with third-party analytics, advertising, or marketing platforms. If
          that changes, we'll update this page.
        </p>
      </LegalSection>

      <LegalSection title="5. Your choices and rights">
        <ul className="list-disc pl-5">
          <li>You can view and edit most of your data any time from Edit Profile.</li>
          <li>You can make your account private, or turn off any of the optional profile-visibility toggles, at any time.</li>
          <li>
            You can delete your account from Settings. This removes your profile details, photo,
            workouts, posts, and personal connections. Messages you've sent stay visible to the
            other person in that conversation (shown as sent by "Deleted User"), so deleting your
            account doesn't erase someone else's conversation history — this is the same approach
            most messaging apps use.
          </li>
          <li>To request a copy of your data, or ask us to delete something this page doesn't cover, contact us using the details below.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Children's privacy">
        <p>
          Box 2 Box is not intended for anyone under 18. We don't knowingly collect data from
          anyone under 18 — if you believe a user is underage, please report their profile.
        </p>
      </LegalSection>

      <LegalSection title="7. Changes to this policy">
        <p>
          We may update this policy as the app changes. We'll update the date at the top of this
          page when we do.
        </p>
      </LegalSection>

      <LegalSection title="8. Contact">
        <p>Questions about this policy, or a data request? Reach out via the contact details on our website.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
