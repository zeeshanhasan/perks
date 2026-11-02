import db from "../db.server";
import { parseJsonList } from "./policy";

export type SetupStep = {
  id: "employer" | "products" | "program" | "theme";
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

export async function getSetup(shop: string, apiKey: string) {
  const [employer, policy, counts] = await Promise.all([
    db.employer.findUnique({ where: { shop } }),
    db.benefitPolicy.findUnique({ where: { shop } }),
    db.employeeMembership.groupBy({ by: ["status", "source"], where: { shop }, _count: true }),
  ]);
  const domains = parseJsonList(employer?.domains);
  const employeeOnly = parseJsonList(policy?.employeeOnlyProducts).length;
  const discounted = parseJsonList(policy?.discountedProducts).length;
  const excluded = parseJsonList(policy?.excludedProducts).length;
  const allProducts = policy?.discountScope === "all_products";

  const steps: SetupStep[] = [
    {
      id: "employer",
      title: "Add your partner company",
      description: "Enter the company name and its email domain, like company.com. People who log in with that email get employee perks.",
      done: Boolean(employer?.name && domains.length),
      action: { label: "Add company", href: "/app/settings" },
    },
    {
      id: "products",
      title: "Choose employee products",
      description: "Pick products only employees can buy, and products where employees get the discount.",
      done: allProducts || employeeOnly + discounted > 0,
      action: { label: "Choose products", href: "/app/products" },
    },
    {
      id: "program",
      title: "Turn on employee perks",
      description: "Switch the program on to start giving employees their discount.",
      done: Boolean(policy?.enabled && policy.discountId),
      action: { label: "Turn on", href: "/app/settings#program" },
    },
    {
      id: "theme",
      title: "Turn on Employee mode in your theme",
      description: "Hides employee-only products from other shoppers and shows employees their perks. One click in the theme editor, then Save.",
      done: false,
      manual: true,
      action: { label: "Open theme editor", href: themeEditorEmbedUrl(shop, apiKey), external: true },
    },
  ];

  const count = (status: string, source?: string) =>
    counts
      .filter((c) => c.status === status && (!source || c.source === source))
      .reduce((n, c) => n + c._count, 0);

  return {
    steps,
    required: steps.filter((s) => !s.manual),
    program: {
      enabled: Boolean(policy?.enabled),
      employerName: employer?.name ?? "",
      domains,
      percent: policy?.discountPercent ?? 10,
      autoDomain: policy?.autoDomain ?? true,
      allProducts,
      employeeOnly,
      discounted,
      excluded,
    },
    stats: {
      active: count("active"),
      viaDomain: count("active", "domain"),
      viaLink: count("active", "link"),
      revoked: count("revoked"),
    },
  };
}
