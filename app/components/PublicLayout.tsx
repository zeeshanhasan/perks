import type { LinksFunction } from "react-router";
import { useEffect, useState } from "react";
import s from "./public.module.css";

// Shared footer and theme for the public site (perks.tofoapp.com): landing, privacy, terms.

export const CONTACT_EMAIL = "hello@tofoapp.com";
/** The App Store listing, once it's live. Until then the Install button opens a note with how to get it. */
export const APP_STORE_URL: string | null = null;
/** A live store to try it on, as a shopper. Its password is public on purpose (it only keeps search engines out). */
export const DEMO_STORE_URL: string | null = "https://employee-perks-demo.myshopify.com";
export const DEMO_STORE_PASSWORD = "ugenti";
export const SITE_URL = "https://perks.tofoapp.com";
export const ICON = "/brand/employee-perks-icon.svg";

/** Icon for the public pages. Text uses Inter, already loaded by the root layout. */
export const publicLinks: LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: ICON },
  { rel: "apple-touch-icon", href: ICON },
];

/** Main call to action: the App Store listing once it's live; until then a panel on the page explains how to get it. */
export function primaryCta(source: string) {
  if (APP_STORE_URL)
    return {
      href: `${APP_STORE_URL}?utm_source=${encodeURIComponent(source)}`,
      label: "Get it on the Shopify App Store",
    };
  return { href: "#install", label: "Install on Shopify" };
}

/** Set the saved theme before the page paints, so dark mode never flashes light. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("perks-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Moon/sun button, like tofoapp.com: follows the device until clicked, then remembers the choice. */
function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme(currentTheme()), []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={s.themeBtn}
      aria-label={`Switch to ${next}`}
      title={`Switch to ${next}`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("perks-theme", next);
        } catch {
          /* private mode: still switches for this visit */
        }
        setTheme(next);
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "dark" ? (
          <path d="M12 3v2M12 19v2M5 5l1.4 1.4M17.6 17.6 19 19M3 12h2M19 12h2M5 19l1.4-1.4M17.6 6.4 19 5M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        ) : (
          <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
        )}
      </svg>
    </button>
  );
}

/** No header: the page itself starts with the app card. The footer carries the links and the theme switch. */
export function PublicLayout({ children }: { children: React.ReactNode; home?: boolean }) {
  return (
    <div className={s.page}>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerInner}`}>
          <a href="/" className={s.footerBrand}>
            Employee Perks <span>by Tofo AI</span>
          </a>
          <nav className={s.footerLinks} aria-label="Footer">
            <a href="/privacy">Privacy policy</a>
            <a href="/terms">Terms of service</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <ThemeSwitch />
          </nav>
        </div>
      </footer>
    </div>
  );
}

export { s as publicStyles };
