/**
 * Storefront (Employee mode) options the merchant edits in the app. Published to the theme embed
 * through the app-data metafield, so nothing needs editing in the theme except switching it on.
 */

export type StorefrontOptions = {
  hideProducts: boolean;
  showPrice: boolean;
  strikePrice: boolean;
  priceLabel: string;
  noticeTitle: string;
  noticeBody: string;
  noticeButton: string;
  badgeText: string;
  /** Public page at /apps/perks listing partner companies and their discounts. Off until the merchant turns it on. */
  perksPage: boolean;
  perksPageDomains: boolean;
  perksPageTitle: string;
  perksPageIntro: string;
};

export const STOREFRONT_DEFAULTS: StorefrontOptions = {
  hideProducts: true,
  showPrice: true,
  strikePrice: true,
  priceLabel: "Your employee price",
  noticeTitle: "Only for partner employees",
  noticeBody: "This product is reserved for employees of our partner companies. Log in with your work email to buy it.",
  noticeButton: "Log in with work email",
  badgeText: "Employee discount: {discount} applied at checkout",
  perksPage: false,
  perksPageDomains: true,
  perksPageTitle: "Employee perks",
  perksPageIntro: "Work at one of these companies? Log in with your work email and your discount is applied at checkout.",
};

export const STOREFRONT_LIMITS: Record<keyof StorefrontOptions, number> = {
  hideProducts: 0,
  showPrice: 0,
  strikePrice: 0,
  priceLabel: 40,
  noticeTitle: 60,
  noticeBody: 240,
  noticeButton: 40,
  badgeText: 80,
  perksPage: 0,
  perksPageDomains: 0,
  perksPageTitle: 60,
  perksPageIntro: 240,
};

const BOOLS = ["hideProducts", "showPrice", "strikePrice", "perksPage", "perksPageDomains"] as const;
const TEXTS = ["priceLabel", "noticeTitle", "noticeBody", "noticeButton", "badgeText", "perksPageTitle", "perksPageIntro"] as const;

/** Parses stored JSON (or a form), falling back to defaults for anything missing or invalid. */
export function parseStorefront(raw: unknown): StorefrontOptions {
  let v: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw) ?? {};
    } catch {
      v = {};
    }
  } else if (raw && typeof raw === "object") v = raw as Record<string, unknown>;
  const out = { ...STOREFRONT_DEFAULTS };
  for (const k of BOOLS) if (typeof v[k] === "boolean") out[k] = v[k] as boolean;
  for (const k of TEXTS) {
    const t = typeof v[k] === "string" ? (v[k] as string).replace(/\s+/g, " ").trim().slice(0, STOREFRONT_LIMITS[k]) : "";
    if (t) out[k] = t;
  }
  return out;
}

const PERKS_PAGE_KEYS = ["perksPage", "perksPageDomains", "perksPageTitle", "perksPageIntro"] as const;

/** The part the theme embed needs (the perks page is served by the app, so it stays out of the theme's data). */
export function themeOptions(o: StorefrontOptions) {
  const rest: Partial<StorefrontOptions> = { ...o };
  for (const k of PERKS_PAGE_KEYS) delete rest[k];
  return rest;
}

export function storefrontFromForm(form: FormData): StorefrontOptions {
  const v: Record<string, unknown> = {};
  for (const k of BOOLS) v[k] = form.get(k) === "on";
  for (const k of TEXTS) v[k] = String(form.get(k) ?? "");
  return parseStorefront(v);
}

/**
 * Whether the Employee mode embed is switched on in the live theme, from its settings_data.json.
 * null when it can't be told (file missing or unreadable).
 */
export function embedEnabled(settingsData: string | null): boolean | null {
  if (!settingsData) return null;
  try {
    const json = JSON.parse(settingsData.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ""));
    const blocks = (json?.current?.blocks ?? {}) as Record<string, { type?: string; disabled?: boolean }>;
    const ours = Object.values(blocks).filter((b) => typeof b?.type === "string" && /\/blocks\/employee-mode\//.test(b.type));
    if (!ours.length) return false;
    return ours.some((b) => b.disabled !== true);
  } catch {
    return null;
  }
}
