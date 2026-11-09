// Beta gate for the post-event results feature — only these account emails
// (case-insensitive) see the login prompt while Lisa tests it for real.
// Widen or delete this check once she says to roll it out to everyone. Every
// other surface (the Results tile/page, the profile Results tab, the feed
// post format, accepting a teammate tag) ships for everyone already — this
// only controls who gets proactively asked to log a result on login.
const RESULTS_PROMPT_BETA_EMAILS = ["vinyljunkie8@gmail.com"];

export function isInResultsPromptBeta(email: string | null | undefined): boolean {
  return !!email && RESULTS_PROMPT_BETA_EMAILS.includes(email.toLowerCase());
}
