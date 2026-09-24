import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" updatedAt="24 September 2026">
      <LegalSection title="1. Who this is for">
        <p>
          Box 2 Box ("we", "us", "the app") is a social network for CrossFit athletes. By creating
          an account you agree to these terms. You must be at least 18 years old to use Box 2 Box.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <p>
          You're responsible for keeping your login details secure and for anything that happens
          under your account. Tell us if you think someone else has access to it. You agree to
          give accurate information when you sign up and keep your profile reasonably up to date.
        </p>
      </LegalSection>

      <LegalSection title="3. Content you post">
        <p>
          You keep ownership of the posts, photos, videos, workout logs, and messages you share on
          Box 2 Box. By posting them, you give us a license to store, display, and distribute that
          content within the app so the features you're using can work (e.g. showing your posts to
          people who follow you, or your event notices to other athletes at that event).
        </p>
        <p>
          Don't post anything you don't have the rights to, and don't post anything illegal,
          harassing, hateful, sexually explicit, or that violates someone else's privacy. See our{" "}
          <a href="/guidelines" className="text-b2b-pink underline">
            Community Guidelines
          </a>{" "}
          for more detail.
        </p>
      </LegalSection>

      <LegalSection title="4. Meeting people through the app">
        <p>
          Box 2 Box helps you find teammates, training partners, and events, and includes optional
          fields for relationship status and what you're looking for. We don't run background
          checks on users. Use good judgement, especially before meeting someone in person for the
          first time — see the safety tips in our{" "}
          <a href="/guidelines" className="text-b2b-pink underline">
            Community Guidelines
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="5. Moderation and enforcement">
        <p>
          We may review reported content, and can remove content or suspend or delete an account
          that breaks these terms or our Community Guidelines, at our discretion, with or without
          notice.
        </p>
      </LegalSection>

      <LegalSection title="6. Fitness and health disclaimer">
        <p>
          Box 2 Box is a social and community platform — it is not a source of medical or fitness
          advice, and workouts, scores, and personal bests shared by other users aren't vetted by
          us. Talk to a qualified professional before starting any new exercise program, and use
          your own judgement about what's safe for your body. You use any workout information
          shared on the app at your own risk.
        </p>
      </LegalSection>

      <LegalSection title="7. No warranty, limitation of liability">
        <p>
          Box 2 Box is provided "as is" while we're still testing and improving it. We don't
          guarantee it will be uninterrupted, error-free, or always available. To the fullest
          extent the law allows, we aren't liable for indirect, incidental, or consequential
          damages arising from your use of the app, including anything arising from interactions
          with other users you meet through it.
        </p>
      </LegalSection>

      <LegalSection title="8. Ending your account">
        <p>
          You can delete your account at any time from Settings. We may suspend or terminate an
          account that violates these terms. See our{" "}
          <a href="/privacy" className="text-b2b-pink underline">
            Privacy Policy
          </a>{" "}
          for what happens to your data when you do.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to these terms">
        <p>
          We may update these terms as the app changes. We'll update the date at the top of this
          page when we do; continuing to use Box 2 Box after a change means you accept the updated
          terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>Questions about these terms? Reach out via the contact details on our website.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
