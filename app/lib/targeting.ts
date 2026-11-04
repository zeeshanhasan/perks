/**
 * Product targeting: which products a rule applies to.
 * Stored as JSON on Business (with titles for the UI); sent to the Functions as ids/strings only.
 */
export type Ref = { id: string; title: string };

export type Targeting = {
  /** Applies to every product (discount targeting only). */
  all: boolean;
  products: Ref[];
  collections: Ref[];
  vendors: string[];
  types: string[];
};

/** Compact form read by the Functions (and the theme embed). */
export type FunctionTarget = {
  all: boolean;
  productIds: string[];
  collectionIds: string[];
  /** lowercased */
  vendors: string[];
  /** lowercased */
  types: string[];
};

export const EMPTY_TARGET: Targeting = { all: false, products: [], collections: [], vendors: [], types: [] };

const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;
const COLLECTION_GID = /^gid:\/\/shopify\/Collection\/\d+$/;

function refs(v: unknown, re: RegExp): Ref[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Ref[] = [];
  for (const r of v) {
    const id = typeof r === "string" ? r : (r as Ref)?.id;
    if (typeof id !== "string" || !re.test(id) || seen.has(id)) continue;
    seen.add(id);
    const title = typeof r === "object" && typeof (r as Ref).title === "string" ? (r as Ref).title.slice(0, 255) : "";
    out.push({ id, title });
  }
  return out;
}

function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const s of v) {
    if (typeof s !== "string") continue;
    const t = s.trim().slice(0, 255);
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

export function parseTargeting(raw: unknown): Targeting {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw || "{}");
    } catch {
      v = {};
    }
  }
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    all: o.all === true,
    products: refs(o.products, PRODUCT_GID),
    collections: refs(o.collections, COLLECTION_GID),
    vendors: strings(o.vendors),
    types: strings(o.types),
  };
}

export function isEmptyTarget(t: Targeting) {
  return !t.all && !t.products.length && !t.collections.length && !t.vendors.length && !t.types.length;
}

export function toFunctionTarget(t: Targeting): FunctionTarget {
  return {
    all: t.all,
    productIds: t.products.map((p) => p.id),
    collectionIds: t.collections.map((c) => c.id),
    vendors: t.vendors.map((s) => s.toLowerCase()),
    types: t.types.map((s) => s.toLowerCase()),
  };
}

/** Human summary, e.g. "3 products, 1 collection, vendor: Nature's Way". */
export function describeTarget(t: Targeting, emptyLabel = "Nothing selected") {
  if (t.all) return "All products";
  const parts: string[] = [];
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  if (t.products.length) parts.push(n(t.products.length, "product"));
  if (t.collections.length) parts.push(n(t.collections.length, "collection"));
  if (t.vendors.length) parts.push(`${t.vendors.length === 1 ? "vendor" : "vendors"}: ${t.vendors.join(", ")}`);
  if (t.types.length) parts.push(`${t.types.length === 1 ? "type" : "types"}: ${t.types.join(", ")}`);
  return parts.length ? parts.join(" · ") : emptyLabel;
}

/** Admin product search query for vendors/types (used to resolve employee-only products). */
export function productSearchQuery(t: Targeting): string | null {
  const q = (field: string, value: string) => `${field}:"${value.replace(/["\\]/g, "")}"`;
  const parts = [...t.vendors.map((v) => q("vendor", v)), ...t.types.map((v) => q("product_type", v))];
  return parts.length ? parts.join(" OR ") : null;
}
