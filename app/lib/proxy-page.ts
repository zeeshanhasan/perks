import { escapeHtml } from "./html";

/**
 * Storefront pages rendered through the app proxy (Liquid, inside the merchant's theme).
 * All dynamic text MUST go through escapeHtml (it also neutralises Liquid syntax).
 */

const STYLE = `
<style>
  .perks { max-width: 560px; margin: 48px auto; padding: 0 16px; font: inherit; }
  .perks h1 { margin: 0 0 12px; }
  .perks p { margin: 0 0 16px; }
  .perks form { display: grid; gap: 12px; margin-top: 16px; }
  .perks input[type=email] { padding: 12px; font: inherit; border: 1px solid #ccc; border-radius: 6px; }
  .perks button, .perks .perks-btn { display: inline-block; padding: 12px 18px; font: inherit; cursor: pointer;
    border: 0; border-radius: 6px; background: #111; color: #fff; text-decoration: none; text-align: center; }
  .perks .perks-note { font-size: .9em; opacity: .75; }
  .perks .perks-msg { padding: 12px; border-radius: 6px; background: #f4f4f4; }
  .perks .perks-msg.error { background: #fdecea; }
  .perks .perks-msg.ok { background: #e7f6ec; }
</style>`;

type Msg = { kind: "ok" | "error" | "info"; text: string };

function shell(title: string, body: string, msg?: Msg) {
  const m = msg
    ? `<p class="perks-msg ${msg.kind}" role="${msg.kind === "error" ? "alert" : "status"}">${escapeHtml(msg.text)}</p>`
    : "";
  return `${STYLE}<div class="perks"><h1>${escapeHtml(title)}</h1>${m}${body}</div>`;
}

const loginReturn = (path: string) =>
  `<a class="perks-btn" href="{{ routes.account_login_url }}?return_url=${encodeURIComponent(path)}">Log in</a>`;

export const pages = {
  disabled: () =>
    shell("Employee perks", `<p>Employee perks aren't available right now.</p>`),

  loggedOut: (returnPath: string, msg?: Msg) =>
    shell(
      "Employee perks",
      `<p>Log in to your store account first, then verify your work email.</p>${loginReturn(returnPath)}`,
      msg,
    ),

  verified: (employerName: string, expiresAt: Date | null, msg?: Msg) =>
    shell(
      "You're verified",
      `<p>You have ${escapeHtml(employerName)} employee perks${
        expiresAt ? ` until ${escapeHtml(expiresAt.toISOString().slice(0, 10))}` : ""
      }.</p><p>Employee prices apply automatically at checkout while you're logged in.</p>
      <a class="perks-btn" href="{{ routes.all_products_collection_url }}">Start shopping</a>`,
      msg,
    ),

  form: (employerName: string, msg?: Msg, prefill = "") =>
    shell(
      "Verify your employee status",
      `<p>Enter your ${escapeHtml(employerName)} work email. We'll send you a one-time link.</p>
      <form method="post" action="/apps/perks/verify">
        <label for="perks-email">Work email</label>
        <input id="perks-email" type="email" name="email" required autocomplete="email" value="${escapeHtml(prefill)}" />
        <button type="submit">Send verification link</button>
      </form>
      <p class="perks-note">Your work email is only used to confirm employment. It won't replace your account email.</p>`,
      msg,
    ),

  sent: () =>
    shell(
      "Check your work email",
      `<p>We sent a verification link. It expires in 30 minutes and works once.</p>
      <p class="perks-note">Open it in this browser while you're logged in to the store.</p>`,
    ),

  confirm: (token: string) =>
    shell(
      "Confirm your employee perks",
      `<form method="post" action="/apps/perks/confirm">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <button type="submit">Confirm</button>
      </form>`,
    ),

  failed: (text: string, showRetry = true) =>
    shell(
      "Verification failed",
      showRetry ? `<a class="perks-btn" href="/apps/perks/verify">Try again</a>` : "",
      { kind: "error", text },
    ),
};

export const REQUEST_MESSAGES: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  domain_not_allowed: "That email domain isn't eligible for employee perks.",
  rate_limited: "Too many attempts. Please try again in an hour.",
  email_in_use: "That work email is already linked to another account. Contact the store if this is wrong.",
  send_failed: "We couldn't send the email. Please try again shortly.",
  disabled: "Employee perks aren't available right now.",
};

export const CONFIRM_MESSAGES: Record<string, string> = {
  invalid: "This link is invalid.",
  not_found: "This link is invalid.",
  used: "This link has already been used.",
  expired: "This link has expired. Request a new one.",
  wrong_customer: "This link belongs to a different account. Log in with the account that requested it.",
  disabled: "Employee perks aren't available right now.",
  domain_not_allowed: "That email domain is no longer eligible.",
  email_in_use: "That work email is already linked to another account.",
  publish_failed: "Something went wrong activating your perks. Please contact the store.",
};
