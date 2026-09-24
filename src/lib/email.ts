import nodemailer from "nodemailer";

type Email = { to: string; subject: string; text: string };

/**
 * Sends transactional email (verification, password reset). Picks the first
 * configured transport:
 *
 * 1. BREVO_API_KEY — Brevo's HTTPS API. Use this on Railway's Hobby plan,
 *    which blocks outbound SMTP connections (they just time out).
 * 2. SMTP_HOST (+ SMTP_PORT/SMTP_USER/SMTP_PASS) — any SMTP provider, for
 *    hosts that allow SMTP.
 * 3. Neither — logs the email to the console, fine for local dev.
 *
 * The sender comes from EMAIL_FROM (or SMTP_FROM), e.g.
 * "Box 2 Box <box2box.admin@gmail.com>".
 *
 * Never throws: a failed send is logged (with the email body, so a link can
 * still be fished out of the logs by hand) and reported as false, so a mail
 * outage can't break signup or password-reset requests.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  try {
    if (process.env.BREVO_API_KEY) {
      await sendViaBrevo(email, process.env.BREVO_API_KEY);
    } else if (process.env.SMTP_HOST) {
      await sendViaSmtp(email);
    } else {
      logEmail("[email:dev-fallback] No email transport configured", email);
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    logEmail("[email:failed] Could not send", email);
    return false;
  }
}

function logEmail(prefix: string, { to, subject, text }: Email) {
  console.log(`${prefix} — to ${to}:\nSubject: ${subject}\n\n${text}`);
}

/** Splits "Name <addr@example.com>" (or a bare address) into its parts. */
function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || undefined, email: match[2] } : { email: from.trim() };
}

async function sendViaBrevo({ to, subject, text }: Email, apiKey: string) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, textContent: text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Brevo API ${res.status}: ${await res.text().catch(() => "")}`);
  }
}

async function sendViaSmtp({ to, subject, text }: Email) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || SMTP_USER,
    to,
    subject,
    text,
  });
}
