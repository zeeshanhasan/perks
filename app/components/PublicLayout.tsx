import type { LinksFunction } from "react-router";
import s from "./public.module.css";

// Shared header and footer for the public site (perks.tofoapp.com): landing, privacy, terms.

export const CONTACT_EMAIL = "hello@tofoapp.com";
/** The App Store listing, once it's live. Until then the main button asks for early access by email. */
export const APP_STORE_URL: string | null = null;
export const SITE_URL = "https://perks.tofoapp.com";
export const ICON = "/brand/employee-perks-icon.svg";

export const earlyAccessMail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Early access: Employee Perks")}`;

/** Icon for the public pages. Text uses Inter, already loaded by the root layout. */
export const publicLinks: LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: ICON },
  { rel: "apple-touch-icon", href: ICON },
];

/** Main call to action: the App Store when listed, otherwise the install box on the landing page. */
export function primaryCta(source: string) {
  if (APP_STORE_URL)
    return {
      href: `${APP_STORE_URL}?utm_source=${encodeURIComponent(source)}`,
      label: "Get it on the Shopify App Store",
    };
  return { href: "/#install", label: "Install on Shopify" };
}

export function PublicLayout({
  children,
  home = false,
}: {
  children: React.ReactNode;
  home?: boolean;
}) {
  const cta = primaryCta("site_header");
  const at = (id: string) => (home ? `#${id}` : `/#${id}`);
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={`${s.wrap} ${s.headerInner}`}>
          <a href="/" className={s.brand}>
            <img
              className={s.brandIcon}
              src={ICON}
              alt=""
              width={30}
              height={30}
            />
            Employee Perks
          </a>
          <nav className={s.nav} aria-label="Main">
            <a className={`${s.navLink} ${s.navOptional}`} href={at("how")}>
              How it works
            </a>
            <a className={s.navLink} href={at("features")}>
              Features
            </a>
            <a className={`${s.navLink} ${s.navOptional}`} href={at("faq")}>
              FAQ
            </a>
            <a className={s.navCta} href={cta.href}>
              Install on Shopify
            </a>
          </nav>
        </div>
      </header>
      {children}
      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerInner}`}>
          <span className={s.footerBrand}>
            <img src={ICON} alt="" width={32} height={32} />
            Employee Perks
          </span>
          <nav className={s.footerLinks} aria-label="Footer">
            <a href="/privacy">Privacy policy</a>
            <a href="/terms">Terms of service</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </nav>
          <span>
            © {new Date().getFullYear()} Tofoapp · An app for Shopify stores
          </span>
        </div>
      </footer>
    </div>
  );
}

export { s as publicStyles };
