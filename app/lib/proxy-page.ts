import { escapeHtml } from "./html";

/**
 * Storefront pages rendered through the app proxy (Liquid, inside the merchant's theme).
 * Uses common theme classes (page-width, button, field__input) so it inherits the theme's look,
 * with light fallbacks. All dynamic text MUST go through escapeHtml (it also neutralises Liquid).
 */

const STYLE = `
<style>
  .perks { max-width: 34rem; margin: 4rem auto; }
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
  // The theme's page-width sets the width and side padding (so it lines up with the header); .perks sits inside it.
  return `${STYLE}<div class="page-width"><div class="perks">
    ${opts.check ? `<div class="perks__check" aria-hidden="true">✓</div>` : ""}
    ${opts.eyebrow ? `<p class="perks__eyebrow">${escapeHtml(opts.eyebrow)}</p>` : ""}
    <h1 class="perks__title h2">${escapeHtml(opts.title)}</h1>
    ${m}
    ${opts.lead ? `<p class="perks__lead">${escapeHtml(opts.lead)}</p>` : ""}
    ${opts.body ?? ""}
  </div></div>`;
}

const loginButton = (returnPath: string) =>
  `<a class="button button--primary" href="{{ routes.account_login_url }}?return_url=${encodeURIComponent(returnPath)}">Log in</a>`;
const shopButton = `<a class="button button--primary" href="{{ routes.all_products_collection_url }}">Start shopping</a>`;

const logoutButton = `<a class="button" href="{{ routes.account_logout_url }}">Log out</a>`;

/** Storefront pages for /apps/perks/verify: a "my perks" status page (decision 016: work-email login only). */
export const pages = {
  disabled: () =>
    shell({ eyebrow: "Employee perks", title: "Not available right now", lead: "Employee perks are currently switched off. Please check back later." }),

  loggedOut: (employerName: string, returnPath: string, msg?: Msg) =>
    shell({
      eyebrow: "Employee perks",
      title: employerName ? `${employerName} employee perks` : "Employee perks",
      lead: "Log in to your store account with your work email. Your employee prices and products unlock automatically.",
      body: `<ol class="perks__steps">
          <li>Log in (or create an account) with your <strong>work email</strong>, e.g. you@company.com.</li>
          <li>Shop as usual: you'll see your employee price, and the discount applies at checkout.</li>
        </ol>${loginButton(returnPath)}`,
      msg,
    }),

  autoEligible: (employerName: string) =>
    shell({
      check: true,
      eyebrow: "Employee perks",
      title: "You're all set",
      lead: `You're logged in with your ${employerName} work email, so employee prices and products are unlocked automatically.`,
      body: shopButton,
    }),

  /** Older employees who verified by email link before decision 016: perks run until their date. */
  verified: (employerName: string, expiresAt: Date | null) =>
    shell({
      check: true,
      eyebrow: "Employee perks",
      title: "You're all set",
      lead: `Your ${employerName} employee perks are active${
        expiresAt ? ` until ${expiresAt.toISOString().slice(0, 10)}` : ""
      }. Employee prices apply automatically at checkout while you're logged in.`,
      body: shopButton,
    }),

  /** Logged in, but not with an approved work email. */
  notEligible: (emailDomain: string | null) =>
    shell({
      eyebrow: "Employee perks",
      title: "Log in with your work email",
      lead: `Employee perks are for customers whose store account uses their work email${
        emailDomain ? `. This account uses an @${emailDomain} address` : ""
      }. Log out, then log in or create an account with your work email (e.g. you@company.com).`,
      body: `${logoutButton}
        <p class="perks__note">Not sure your company is a partner? Ask your HR team, or contact the store.</p>`,
    }),

  revoked: () =>
    shell({
      eyebrow: "Employee perks",
      title: "Perks removed",
      lead: "Employee perks were removed from this account. If you think this is a mistake, please contact the store.",
    }),
};

// --- Public perks page (/apps/perks) -----------------------------------------------------

export type PerksPageItem = { name: string; discount: string; appliesTo: string; domains: string[] };

const PERKS_STYLE = `
<style>
  /* The list page uses the theme's full content width, starting where the theme's content starts.
     Two classes, because the base .perks rule comes later in the page and would otherwise win. */
  .perks.perks--wide { max-width: none; margin: 3rem 0 4rem; }
  .perks.perks--wide .button { width: auto; }
  .perks__list { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); margin: 0 0 2rem; padding: 0; list-style: none; }
  .perks__card { border: 1px solid rgba(0,0,0,.12); border-radius: 8px; padding: 1.25rem; }
  .perks__card h2 { margin: 0 0 .25rem; font-size: 1.15em; }
  .perks__deal { font-size: 1.5em; font-weight: 600; margin: .25rem 0; }
  .perks__meta { font-size: .9rem; opacity: .75; margin: .25rem 0 0; }
</style>`;

/** "On everything", or up to 3 collection/product names. */
export function publicAppliesTo(t: { all: boolean; collections: { title?: string }[]; products: { title?: string }[]; vendors: string[]; types: string[] }) {
  if (t.all) return "On everything in the store";
  const names = [...t.collections, ...t.products].map((x) => x.title).filter((x): x is string => Boolean(x));
  const all = [...names, ...t.vendors, ...t.types];
  if (!all.length) return "On selected products";
  const shown = all.slice(0, 3).join(", ");
  return `On ${shown}${all.length > 3 ? ` and ${all.length - 3} more` : ""}`;
}

export function perksPage(opts: { title: string; intro: string; items: PerksPageItem[]; showDomains: boolean; loggedIn: boolean }) {
  const cards = opts.items
    .map(
      (i) => `<li class="perks__card">
        <h2>${escapeHtml(i.name)}</h2>
        <p class="perks__deal">${escapeHtml(i.discount)}</p>
        <p class="perks__meta">${escapeHtml(i.appliesTo)}</p>
        ${opts.showDomains && i.domains.length ? `<p class="perks__meta">For ${i.domains.map((d) => `@${escapeHtml(d)}`).join(", ")} emails</p>` : ""}
      </li>`,
    )
    .join("");
  const body = opts.items.length
    ? `<ul class="perks__list">${cards}</ul>
       <a class="button button--primary" href="/apps/perks/verify">${opts.loggedIn ? "Check my perks" : "Get my perks"}</a>
       <p class="perks__note">Perks apply automatically at checkout when you're logged in with your work email.</p>`
    : `<p class="perks__lead">There are no employee perks to show right now.</p>`;
  return PERKS_STYLE + shell({ eyebrow: "Employee perks", title: opts.title, lead: opts.intro, body }).replace('class="perks"', 'class="perks perks--wide"');
}
