import { redirect } from "next/navigation";

// This link circulated before it was meant to — bounce anyone who still has
// it to the current entry point rather than leaving it live or dead.
export default function WelcomeRedirectPage() {
  redirect("/start");
}
