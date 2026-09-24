import nodemailer from "nodemailer";

/**
 * Sends transactional email (verification, password reset) via SMTP when
 * configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM env vars —
 * works with any provider: Gmail, SendGrid, Postmark, Resend's SMTP, SES,
 * etc.). Without those set, it just logs the email to the console — good
 * enough for local dev, but real verification/reset emails won't be
 * deliverable until SMTP is configured in the deploy environment.
 */
export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST) {
    console.log(`[email:dev-fallback] SMTP not configured — would send to ${to}:\nSubject: ${subject}\n\n${text}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject,
    text,
  });
}
