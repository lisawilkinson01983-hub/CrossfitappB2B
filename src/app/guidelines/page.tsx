import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";

export default function GuidelinesPage() {
  return (
    <LegalPageLayout title="Community Guidelines" updatedAt="24 September 2026">
      <p>
        Box 2 Box only works if people feel safe using it. These guidelines back up our{" "}
        <a href="/terms" className="text-b2b-pink underline">
          Terms of Service
        </a>{" "}
        — breaking them can lead to content being removed or an account being suspended.
      </p>

      <LegalSection title="Be respectful">
        <p>
          No harassment, hate speech, threats, or bullying. Disagreements happen — keep them
          civil. Respect other people's boundaries, especially around messaging and event notices.
        </p>
      </LegalSection>

      <LegalSection title="Be honest">
        <p>
          Use a real photo and accurate information about yourself. Don't impersonate someone
          else, misrepresent your affiliate gym, or fake results. Don't create multiple accounts
          to get around a suspension or block.
        </p>
      </LegalSection>

      <LegalSection title="Keep it appropriate">
        <p>
          No sexually explicit content, no spam or scams, and nothing illegal. Event notices and
          the notice board are for finding teammates and training partners — keep them on-topic.
        </p>
      </LegalSection>

      <LegalSection title="Meeting people safely">
        <p>
          Box 2 Box helps you find teammates, training partners, and people to connect with — some
          of that happens in person. A few basics:
        </p>
        <ul className="list-disc pl-5">
          <li>Meet for the first time in a public place — a box, a gym, an event — not somewhere private.</li>
          <li>Tell a friend where you're going and who you're meeting.</li>
          <li>Trust your instincts — if something feels off, it's okay to leave or cancel.</li>
          <li>Don't send money to someone you've only met through the app.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Reporting">
        <p>
          You can report a post, comment, message, event notice, or profile directly from the app
          — look for the "Report" option next to the content. Our moderators review reports and
          take action when something breaks these guidelines.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
