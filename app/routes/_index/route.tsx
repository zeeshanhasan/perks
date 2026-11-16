import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { useEffect } from "react";
import { redirect, Form, useActionData, useNavigate } from "react-router";

import {
  CONTACT_EMAIL,
  APP_STORE_URL,
  ICON,
  PublicLayout,
  SITE_URL,
  primaryCta,
  publicLinks,
  publicStyles as s,
} from "../../components/PublicLayout";
import { login } from "../../shopify.server";
import { normalizeShop } from "../../lib/shop-address";
import { loginErrorMessage } from "./error.server";

// perks.tofoapp.com: the public landing page. Inside the Shopify admin it hands straight over to the app.

const TITLE = "Employee Perks: employee discounts for Shopify stores";
const DESCRIPTION =
  "Give partner companies' employees automatic discounts, employee prices and employee-only products in your Shopify store. They log in with their work email; the discount applies at checkout.";

export const links: LinksFunction = publicLinks;

export const meta: MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { tagName: "link", rel: "canonical", href: `${SITE_URL}/` },
  { property: "og:type", content: "website" },
  { property: "og:url", content: `${SITE_URL}/` },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
  { property: "og:site_name", content: "Employee Perks" },
  { property: "og:image", content: `${SITE_URL}${ICON}` },
  { name: "twitter:card", content: "summary" },
  { name: "twitter:title", content: TITLE },
  { name: "twitter:description", content: DESCRIPTION },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  const p = url.searchParams;
  // Opened from the Shopify admin (embedded iframe): go straight to the app, never the landing page.
  const embedded =
    p.get("shop") ||
    p.get("host") ||
    p.get("embedded") ||
    p.get("id_token") ||
    request.headers.get("sec-fetch-dest") === "iframe";
  if (embedded) {
    throw redirect(`/app?${p.toString()}`);
  }

  return null;
};

/** Install (or open) on Shopify: Shopify's own login sends new stores to its install screen. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const shop = normalizeShop(String(form.get("shop") ?? ""));
  const next = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ shop }),
  });
  const errors = loginErrorMessage(await login(next));
  return { errors, form: String(form.get("where") ?? "") };
};

/** Store address + "Install on Shopify". Installed stores go straight to the app. */
function InstallForm({
  where,
  error,
  ghost = false,
}: {
  where: string;
  error?: string;
  ghost?: boolean;
}) {
  return (
    <Form className={s.install} method="post">
      <input type="hidden" name="where" value={where} />
      <div className={s.installField}>
        <input
          className={s.input}
          type="text"
          name="shop"
          placeholder="your-store.myshopify.com"
          aria-label="Your Shopify store address"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className={`${s.btn} ${ghost ? s.btnWhite : s.btnPrimary}`}
          type="submit"
        >
          Install on Shopify
        </button>
      </div>
      {error ? <span className={s.error}>{error}</span> : null}
    </Form>
  );
}

const STEPS = [
  [
    "Add a partner company",
    "Enter its name, its work email domain (like acme.com) and the discount its employees get.",
  ],
  [
    "Employees log in",
    "They log in to your store with their work email. Shopify's login code proves it's really theirs.",
  ],
  [
    "The discount applies",
    "They see their employee price while they shop, and the discount is applied at checkout. No codes.",
  ],
] as const;

/** Simple line icons (24px grid, stroke = currentColor). */
const ICONS: Record<string, React.ReactNode> = {
  key: (
    <path d="M15 7a4 4 0 1 1-3.9 4.9L4 19v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7Zm1.5 2.5h.01" />
  ),
  tag: (
    <path d="M3 12V4h8l9.3 9.3a1 1 0 0 1 0 1.4l-6.6 6.6a1 1 0 0 1-1.4 0L3 12Zm4.5-4.5h.01" />
  ),
  lock: <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />,
  gauge: <path d="M4 15a8 8 0 1 1 16 0M12 15l4-5M3 19h18" />,
  file: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  page: <path d="M4 5h16v14H4zM4 9h16M8 13h3M8 16h6" />,
};
function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const FEATURES = [
  [
    "key",
    "iconSun",
    "Automatic perks",
    "No codes to share or leak. Anyone logged in with an approved work email gets the discount; guests never do.",
  ],
  [
    "tag",
    "iconCoral",
    "Employee prices in your theme",
    "Employees see their own price on product pages and in collections, with the normal price crossed out.",
  ],
  [
    "lock",
    "iconTeal",
    "Employee-only products",
    "Make products only a company's employees can buy. Everyone else is stopped at checkout.",
  ],
  [
    "gauge",
    "iconSun",
    "Limits per employee",
    "Cap the discount or the spend every month or every year. It stops exactly at the limit.",
  ],
  [
    "file",
    "iconCoral",
    "Invoices for each company",
    "See what every company's employees bought and bill them for the discount or the spend, as PDF and Excel.",
  ],
  [
    "page",
    "iconTeal",
    "A public perks page",
    "List your partner companies and their discounts on your store, so employees know what they get.",
  ],
] as const;

const FAQ = [
  [
    "Who is it for?",
    "Shopify stores that sell to employees of partner companies (corporate deals, pharmacies, gyms, B2B partners), or that give their own staff a discount.",
  ],
  [
    "Can someone get the discount by typing a work email at checkout?",
    "No. Perks only apply to customers who are logged in, and the work email is proved by Shopify's login code.",
  ],
  [
    "What if an employee's store account uses a personal email?",
    "Perks need an account with their work email. They log out and log in, or create an account, with their work email. Your store tells them so if they try."
  ],
  [
    "Does it change my theme code?",
    "No. Employee prices and hidden products come from a Shopify theme app embed you switch on in one click. Uninstalling leaves nothing behind.",
  ],
  ["Which plans does it work on?", "Every Shopify plan."],
] as const;

export default function Landing() {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  // Inside the Shopify admin (e.g. the app title link), always show the app, never this page.
  useEffect(() => {
    if (window.top !== window.self)
      navigate(`/app${window.location.search}`, { replace: true });
  }, [navigate]);
  const errors = actionData?.errors;
  const hero = primaryCta("site_hero");
  const bottom = primaryCta("site_bottom");

  return (
    <PublicLayout home>
      <main>
        <section className={s.hero}>
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div>
              <span className={s.eyebrow}>
                <span className={s.dot} aria-hidden="true" />
                Employee discounts for Shopify
              </span>
              <h1 className={s.h1}>
                Corporate perks your partners&apos; employees{" "}
                <em>actually use.</em>
              </h1>
              <p className={s.lead}>
                Give each partner company&apos;s employees their own prices and
                products. They log in with their work email, see their price
                while they shop, and the discount applies at checkout.
              </p>
              {APP_STORE_URL ? (
                <div className={s.ctaRow}>
                  <a className={`${s.btn} ${s.btnPrimary}`} href={hero.href}>
                    {hero.label}
                  </a>
                  <a className={`${s.btn} ${s.btnGhost}`} href="#how">
                    See how it works
                  </a>
                </div>
              ) : (
                <div id="install">
                  <InstallForm
                    where="hero"
                    error={
                      actionData?.form === "hero" ? errors?.shop : undefined
                    }
                  />
                  <p className={s.small} style={{ margin: "10px 0 0" }}>
                    Takes about a minute. You approve the install in your
                    Shopify admin.
                  </p>
                </div>
              )}
              <div className={s.trust}>
                <span>No discount codes</span>
                <span>Works on every Shopify plan</span>
                <span>No theme code changes</span>
              </div>
            </div>

            <div className={s.art} aria-hidden="true">
              <div className={s.window}>
                <div className={s.windowBar}>
                  <i />
                  <i />
                  <i />
                  <b>yourstore.com/products/vitamin-c</b>
                </div>
                <div className={s.product}>
                  <div className={s.productImg}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 3h8v4H8zM7 7h10v14H7zM10 12h4M12 10v4" />
                    </svg>
                  </div>
                  <div>
                    <div className={s.productTitle}>Vitamin C, 60 tablets</div>
                    <div className={s.staffLabel}>Your staff price</div>
                    <div className={s.priceRow}>
                      <span className={s.now}>Rs 1,700</span>
                      <span className={s.was}>Rs 2,000</span>
                      <span className={s.pill}>15% off</span>
                    </div>
                    <span className={s.addBtn}>Add to cart</span>
                  </div>
                </div>
              </div>
              <div className={s.checkout}>
                <div className={s.checkoutTitle}>
                  <img src={ICON} alt="" width={18} height={18} />
                  Checkout
                </div>
                <div className={s.line}>
                  <span>Subtotal</span>
                  <span>Rs 2,000</span>
                </div>
                <div className={`${s.line} ${s.lineSave}`}>
                  <span>Employee perks · Acme</span>
                  <span>−Rs 300</span>
                </div>
                <div className={`${s.line} ${s.lineTotal}`}>
                  <span>Total</span>
                  <span>Rs 1,700</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className={`${s.section} ${s.sectionAlt}`}>
          <div className={s.wrap}>
            <p className={s.kicker}>How it works</p>
            <h2 className={s.h2}>
              Live in minutes. Nothing for employees to remember.
            </h2>
            <p className={s.sub}>
              Set up a company once. Its employees get their perks every time
              they shop.
            </p>
            <ol className={s.steps}>
              {STEPS.map(([title, text]) => (
                <li key={title} className={s.step}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className={s.section}>
          <div className={s.wrap}>
            <p className={s.kicker}>Features</p>
            <h2 className={s.h2}>Everything an employee perks program needs</h2>
            <p className={s.sub}>
              As many partner companies as you like, each with its own discount,
              products and limits.
            </p>
            <div className={s.cards}>
              {FEATURES.map(([icon, tone, title, text]) => (
                <div key={title} className={s.card}>
                  <div className={`${s.icon} ${s[tone]}`}>
                    <Icon name={icon} />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className={s.section}>
          <div className={s.wrap}>
            <p className={s.kicker}>FAQ</p>
            <h2 className={s.h2}>Questions</h2>
            <div className={s.faq} style={{ marginTop: 32 }}>
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
            <p className={s.small} style={{ marginTop: 24 }}>
              Something else? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
        </section>

        <section className={s.section} style={{ paddingTop: 0 }}>
          <div className={s.wrap}>
            <div className={s.closing}>
              <div>
                <h2 className={s.h2} style={{ color: "#fff" }}>
                  Give your partners&apos; employees a reason to shop with you.
                </h2>
                <p className={s.priceNote}>
                  Set up your first company in a few minutes. Already installed?
                  The same box opens the app.
                </p>
              </div>
              {APP_STORE_URL ? (
                <a className={`${s.btn} ${s.btnWhite}`} href={bottom.href}>
                  {bottom.label}
                </a>
              ) : (
                <InstallForm
                  where="bottom"
                  ghost
                  error={
                    actionData?.form === "bottom" ? errors?.shop : undefined
                  }
                />
              )}
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
