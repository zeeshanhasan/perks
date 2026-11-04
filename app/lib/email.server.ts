import { escapeHtml } from "./html";

export type VerificationEmail = {
  to: string;
  employerName: string;
  shopName: string;
  link: string;
};

/**
 * Dev (no RESEND_API_KEY): prints the link to the server console.
 * Prod: sends via Resend's HTTP API (works on Node and Workers).
 */
export async function sendVerificationEmail(msg: VerificationEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `\n[perks:dev-email] Verification link (console transport, no email sent):\n  ${msg.link}\n`,
    );
    return;
  }
  const from = process.env.PERKS_EMAIL_FROM || "Employee Perks <perks@mail.tofoapp.com>";
  const html = `
    <p>Hi,</p>
    <p>Confirm your ${escapeHtml(msg.employerName)} work email to unlock employee perks at ${escapeHtml(msg.shopName)}.</p>
    <p><a href="${escapeHtml(msg.link)}">Confirm my employee status</a></p>
    <p>This link expires in 30 minutes and works once. Open it in the browser where you're logged in to the store.</p>
    <p>If you didn't request this, ignore this email.</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [msg.to], subject: "Confirm your employee perks", html }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
}
