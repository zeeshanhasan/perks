import db from "../db.server";
import { describeDiscount } from "./business";
import { listBusinesses } from "./business.server";
import { businessSummary } from "./invoice.server";
import type { MonthRange } from "./home";
import { monthRange, previousMonth } from "./home";
import { parseStorefront } from "./storefront";

export type SetupStep = {
  id: "business" | "program" | "theme";
  title: string;
  description: string;
  done: boolean;
  /** Can't be detected automatically (theme editor). */
  manual?: boolean;
  action: { label: string; href: string; external?: boolean };
};

export function themeEditorEmbedUrl(shop: string, apiKey: string) {
  const handle = shop.replace(".myshopify.com", "");
  return `https://admin.shopify.com/store/${handle}/themes/current/editor?context=apps&activateAppId=${apiKey}/employee-mode`;
}

/** Orders, spend, discount, employees and businesses for one month (businesses and employees as of its end). */
async function monthNumbers(shop: string, r: MonthRange) {
  const [usage, employees, newEmployees, businesses, invoices] = await Promise.all([
    businessSummary(shop, r.from, r.to),
    db.employeeMembership.count({ where: { shop, createdAt: { lt: r.to } } }),
    db.employeeMembership.count({ where: { shop, createdAt: { gte: r.from, lt: r.to } } }),
    db.business.count({ where: { shop, createdAt: { lt: r.to }, OR: [{ archivedAt: null }, { archivedAt: { gte: r.to } }] } }),
    db.invoice.count({ where: { shop, createdAt: { gte: r.from, lt: r.to } } }),
  ]);
  return { ...usage.totals, employees, newEmployees, businesses, invoices, label: r.label, key: r.key };
}

export async function getSetup(
  shop: string,
  apiKey: string,
  currency: string,
  embedOn: boolean | null = null,
  month: string | null = null,
) {
  const businesses = await listBusinesses(shop);
  const [policy, counts] = await Promise.all([
    db.benefitPolicy.findUnique({ where: { shop } }),
    db.employeeMembership.groupBy({ by: ["status", "source"], where: { shop }, _count: true }),
  ]);
  const selected = monthRange(month);
  const [current, previous] = await Promise.all([monthNumbers(shop, selected), monthNumbers(shop, previousMonth(selected))]);

  const steps: SetupStep[] = [
    {
      id: "business",
      title: "Add a partner business",
      description: "Add a company, its work email domains, its discount and which products it applies to.",
      done: businesses.length > 0,
      action: { label: "Add business", href: "/app/businesses/new" },
    },
    {
      id: "program",
      title: "Turn on employee perks",
      description: "Switch the program on in Settings to start giving discounts.",
      done: Boolean(policy?.enabled && policy.discountId),
      action: { label: "Open settings", href: "/app/settings" },
    },
    {
      id: "theme",
      title: "Turn on Employee mode in your theme",
      description: "Shows employees their prices and hides employee-only products from other shoppers. One click, then Save.",
      done: embedOn === true,
      manual: embedOn === null,
      action: { label: "Turn on Employee mode", href: themeEditorEmbedUrl(shop, apiKey), external: true },
    },
  ];

  const count = (status: string, source?: string) =>
    counts.filter((c) => c.status === status && (!source || c.source === source)).reduce((n, c) => n + c._count, 0);

  return {
    steps,
    required: steps.filter((s) => !s.manual),
    enabled: Boolean(policy?.enabled),
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      domains: b.domains.join(", "),
      discount: describeDiscount(b, currency),
      active: b.active,
    })),
    stats: {
      active: count("active"),
      viaDomain: count("active", "domain"),
      viaLink: count("active", "link"),
      revoked: count("revoked"),
    },
    perksPage: parseStorefront(policy?.storefront).perksPage,
    month: current,
    lastMonth: previous,
  };
}
