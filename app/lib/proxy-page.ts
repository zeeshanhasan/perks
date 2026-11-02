import { escapeHtml } from "./html";

/**
 * Storefront pages rendered through the app proxy (Liquid, inside the merchant's theme).
 * Uses common theme classes (page-width, button, field__input) so it inherits the theme's look,
 * with light fallbacks. All dynamic text MUST go through escapeHtml (it also neutralises Liquid).
 */

const STYLE = `
<style>
  .perks { max-width: 34rem; margin: 4rem auto; padding: 0 1.5rem; }
  .perks__eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: .8rem; opacity: .65; margin: 0 0 .5rem; }
  .perks__title { margin: 0 0 1rem; }
  .perks__lead { margin: 0 0 1.5rem; opacity: .85; }
  .perks__form { display: grid; gap: .75rem; margin: 0 0 1rem; }
  .perks__form label { font-size: .9rem; }
  .perks__form input[type=email] { width: 100%; box-sizing: border-box; min-height: 4.4rem; padding: 0 1.2rem;
    border: 1px solid rgba(0,0,0,.25); border-radius: var(--inputs-radius, 4px); font: inherit; background: transparent; color: inherit; }
  .perks .button { width: 100%; }
  .perks__note { font-size: .85rem; opacity: .7; margin: 1rem 0 0; }
  .perks__msg { padding: 1rem 1.2rem; border-radius: 6px; margin: 0 0 1.5rem; border: 1px solid rgba(0,0,0,.12); }
  .perks__msg--error { border-color: #d72c0d; color: #8e1f0b; background: #fff4f4; }
  .perks__msg--ok { border-color: #29845a; color: #0c5132; background: #f1fbf5; }
  .perks__check { display: inline-flex; width: 3.2rem; height: 3.2rem; border-radius: 50%; align-items: center;
    justify-content: center; background: #29845a; color: #fff; font-size: 1.6rem; margin-bottom: 1rem; }
  .perks__steps { padding-left: 1.2rem; margin: 0 0 1.5rem; }
  .perks__steps li { margin: .25rem 0; }
</style>`;

type Msg = { kind: "ok" | "error" | "info"; text: string };

function shell(opts: { eyebrow?: string; title: string; lead?: string; body?: string; msg?: Msg; check?: boolean }) {
  const m = opts.msg
    ? `<div class="perks__msg perks__msg--${opts.msg.kind}" role="${opts.msg.kind === "error" ? "alert" : "status"}">${escapeHtml(opts.msg.text)}</div>`
    : "";
  return `${STYLE}<div class="perks page-width">
    ${opts.check ? `<div class="perks__check" aria-hidden="true">✓</div>` : ""}
    ${opts.eyebrow ? `<p class="perks__eyebrow">${escapeHtml(opts.eyebrow)}</p>` : ""}
    <h1 class="perks__title h2">${escapeHtml(opts.title)}</h1>
    ${m}
    ${opts.lead ? `<p class="perks__lead">${escapeHtml(opts.lead)}</p>` : ""}
    ${opts.body ?? ""}
  </div>`;
}

const loginButton = (returnPath: string) =>
  `<a class="button button--primary" href="{{ routes.account_login_url }}?return_url=${encodeURIComponent(returnPath)}">Log in</a>`;
const shopButton = `<a class="button button--primary" href="{{ routes.all_products_collection_url }}">Start shopping</a>`;

export const pages = {
  disabled: () =>
    shell({ eyebrow: "Employee perks", title: "Not available right now", lead: "Employee perks are currently switched off. Please check back later." }),

  loggedOut: (employerName: string, returnPath: string, msg?: Msg) =>
    shell({
      eyebrow: "Employee perks",
      title: employerName ? `${employerName} employee perks` : "Employee perks",
      lead: "Log in to your store account to get started.",
      body: `<ol class="perks__steps">
          <li>Log in with your <strong>work email</strong>: perks apply automatically.</li>
          <li>Shopping with a personal email? Log in, then verify your work email here.</li>
        </ol>${loginButton(returnPath)}`,
      msg,
    }),

  autoEligible: (employerName: string) =>
    shell({
      check: true,
      eyebrow: "Employee perks",
      title: "You're all set",
      lead: `You're logged in with a ${employerName} work email, so employee prices and products are unlocked automatically.`,
      body: shopButton,
    }),

  verified: (employerName: string, expiresAt: Date | null, msg?: Msg) =>
    shell({
      check: true,
      eyebrow: "Employee perks",
      title: "You're verified",
      lead: `Your ${employerName} employee perks are active${
        expiresAt ? ` until ${expiresAt.toISOString().slice(0, 10)}` : ""
      }. Employee prices apply automatically at checkout while you're logged in.`,
      body: shopButton,
      msg,
    }),

  form: (employerName: string, msg?: Msg, prefill = "") =>
    shell({
      eyebrow: "Employee perks",
      title: "Verify your work email",
      lead: `Shopping with a personal email? Enter your ${employerName} work email and we'll send you a one-time link.`,
      body: `<form class="perks__form" method="post" action="/apps/perks/verify">
          <label for="perks-email">Work email</label>
          <input id="perks-email" type="email" name="email" required autocomplete="email" placeholder="you@company.com" value="${escapeHtml(prefill)}" />
          <button type="submit" class="button button--primary">Send verification link</button>
        </form>
        <p class="perks__note">We only use your work email to confirm employment. It won't change your account email or be shared.</p>`,
      msg,
    }),

  revoked: () =>
    shell({
      eyebrow: "Employee perks",
      title: "Perks removed",
      lead: "Employee perks were removed from this account. If you think this is a mistake, please contact the store.",
    }),

  sent: () =>
    shell({
      eyebrow: "Employee perks",
      title: "Check your work email",
      lead: "We sent you a verification link. It expires in 30 minutes and can be used once.",
      body: `<p class="perks__note">Open the link in this browser while you're logged in to the store. Can't find it? Check spam, or <a href="/apps/perks/verify">try again</a>.</p>`,
    }),

  confirm: (token: string) =>
    shell({
      eyebrow: "Employee perks",
      title: "Confirm your employee perks",
      lead: "One last click to activate your perks on this account.",
      body: `<form class="perks__form" method="post" action="/apps/perks/confirm">
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          <button type="submit" class="button button--primary">Confirm</button>
        </form>`,
    }),

  failed: (text: string, showRetry = true) =>
    shell({
      eyebrow: "Employee perks",
      title: "That didn't work",
      body: showRetry ? `<a class="button" href="/apps/perks/verify">Try again</a>` : "",
      msg: { kind: "error", text },
    }),
};

export const REQUEST_MESSAGES: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  domain_not_allowed: "That email domain isn't part of this employee program.",
  rate_limited: "Too many attempts. Please try again in an hour.",
  email_in_use: "That work email is already linked to another account. Contact the store if this is wrong.",
  send_failed: "We couldn't send the email. Please try again shortly.",
  disabled: "Employee perks aren't available right now.",
  revoked: "Employee perks were removed from this account. Please contact the store.",
};

export const CONFIRM_MESSAGES: Record<string, string> = {
  invalid: "This link is invalid.",
  not_found: "This link is invalid.",
  used: "This link has already been used.",
  expired: "This link has expired. Request a new one.",
  wrong_customer: "This link belongs to a different account. Log in with the account that requested it.",
  disabled: "Employee perks aren't available right now.",
  revoked: "Employee perks were removed from this account. Please contact the store.",
  domain_not_allowed: "That email domain is no longer part of this employee program.",
  email_in_use: "That work email is already linked to another account.",
  publish_failed: "Something went wrong activating your perks. Please contact the store.",
};
