/**
 * Creates/updates the Shopify objects the app owns:
 * - an automatic app discount backed by the perks-discount Function
 * - a cart & checkout validation (checkout rule) backed by the perks-validation Function
 * - an app-data metafield the theme embed reads (app.metafields.perks.storefront)
 * Both Functions read a v2 config ($app.perks_config) and input variables ($app.perks_vars).
 */
import type { BenefitPolicy } from "@prisma/client";
import type { AdminClient } from "./admin-graphql.server";
import { assertNoUserErrors, gql } from "./admin-graphql.server";
import type { BusinessView } from "./business.server";
import { DISCOUNT_CONFIG_KEY, ELIGIBILITY_NAMESPACE, STOREFRONT_KEY, STOREFRONT_NAMESPACE } from "./eligibility";
import { setMetafields } from "./metafields.server";
import { parseJsonList } from "./policy";
import { parseStorefront, themeOptions } from "./storefront";
import { toFunctionTarget } from "./targeting";

export const DISCOUNT_TITLE = "Employee perks";
export const VALIDATION_TITLE = "Employee-only products";
export const VARS_KEY = "perks_vars";

type FunctionNode = { id: string; apiType: string; title: string };

export async function findFunctions(admin: AdminClient) {
  const data = await gql<{ shopifyFunctions: { nodes: FunctionNode[] } }>(
    admin,
    `#graphql
    query PerksFunctions { shopifyFunctions(first: 25) { nodes { id apiType title } } }`,
  );
  const nodes = data.shopifyFunctions.nodes;
  return {
    discount: nodes.find((n) => /discount/i.test(n.apiType) && !/allocator/i.test(n.apiType)) ?? null,
    validation: nodes.find((n) => /validation/i.test(n.apiType)) ?? null,
  };
}

/** The config both Functions read. Only active businesses are included. */
export function functionConfig(policy: Pick<BenefitPolicy, "autoDomain" | "excludedProducts">, businesses: BusinessView[]) {
  return {
    v: 2 as const,
    autoDomain: policy.autoDomain,
    excluded: parseJsonList(policy.excludedProducts),
    businesses: businesses
      .filter((b) => b.active)
      .map((b) => ({
        id: b.id,
        domains: b.domains,
        type: b.discountType === "fixed" ? "fixed" : "percentage",
        value: b.discountValue,
        target: toFunctionTarget(b.discountTarget),
        employeeOnly: { ...toFunctionTarget(b.employeeOnlyTarget), all: false },
        limit:
          b.limitPeriod !== "none" && b.limitAmount
            ? { period: b.limitPeriod, basis: b.limitBasis, amount: b.limitAmount }
            : null,
      })),
  };
}

/** Input variables: every collection any business targets. */
export function functionVars(businesses: BusinessView[]) {
  const ids = new Set<string>();
  for (const b of businesses.filter((x) => x.active))
    for (const c of [...b.discountTarget.collections, ...b.employeeOnlyTarget.collections]) ids.add(c.id);
  return { collectionIds: [...ids] };
}

function ownerMetafields(ownerId: string, config: unknown, vars: unknown) {
  return [
    { ownerId, namespace: ELIGIBILITY_NAMESPACE, key: DISCOUNT_CONFIG_KEY, type: "json", value: JSON.stringify(config) },
    { ownerId, namespace: ELIGIBILITY_NAMESPACE, key: VARS_KEY, type: "json", value: JSON.stringify(vars) },
  ];
}

const combinesWith = (p: BenefitPolicy) => ({
  productDiscounts: p.combinesWithProduct,
  orderDiscounts: p.combinesWithOrder,
  shippingDiscounts: p.combinesWithShipping,
});

async function discountExists(admin: AdminClient, id: string): Promise<boolean> {
  try {
    const data = await gql(admin, `#graphql
      query PerksDiscountNode($id: ID!) { discountNode(id: $id) { id } }`, { id });
    return Boolean(data.discountNode);
  } catch {
    return false;
  }
}

type DiscountPage = {
  discountNodes: {
    nodes: { id: string; discount: { __typename: string; title?: string; appDiscountType?: { functionId: string } } }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

/**
 * Our own automatic discount, found by its Function. Lets us re-adopt it when the saved id was lost,
 * instead of creating a duplicate (Shopify requires unique titles for automatic discounts).
 */
async function findOwnDiscount(admin: AdminClient, functionId: string) {
  let after: string | null = null;
  const titles = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const data: DiscountPage = await gql<DiscountPage>(admin, `#graphql
      query PerksFindDiscounts($after: String) {
        discountNodes(first: 100, after: $after) {
          nodes { id discount { __typename ... on DiscountAutomaticApp { title appDiscountType { functionId } } ... on DiscountAutomaticBasic { title } ... on DiscountAutomaticBxgy { title } ... on DiscountAutomaticFreeShipping { title } } }
          pageInfo { hasNextPage endCursor }
        }
      }`, { after });
    for (const n of data.discountNodes.nodes) {
      if (n.discount.appDiscountType?.functionId === functionId) return { id: n.id, titles };
      if (n.discount.title) titles.add(n.discount.title);
    }
    if (!data.discountNodes.pageInfo.hasNextPage) break;
    after = data.discountNodes.pageInfo.endCursor;
  }
  return { id: null, titles };
}

/** "Employee perks", or "Employee perks (2)" when another discount already has that title. */
export function freeTitle(taken: Set<string>) {
  if (!taken.has(DISCOUNT_TITLE)) return DISCOUNT_TITLE;
  for (let n = 2; ; n++) if (!taken.has(`${DISCOUNT_TITLE} (${n})`)) return `${DISCOUNT_TITLE} (${n})`;
}

/** Returns the discount node GID. */
export async function ensureDiscount(admin: AdminClient, policy: BenefitPolicy, businesses: BusinessView[]): Promise<string> {
  let id = policy.discountId && (await discountExists(admin, policy.discountId)) ? policy.discountId : null;
  let title = DISCOUNT_TITLE;

  if (!id) {
    const fns = await findFunctions(admin);
    if (!fns.discount) throw new Error("Discount Function not deployed. Run `shopify app deploy` first.");
    const own = await findOwnDiscount(admin, fns.discount.id);
    id = own.id;
    title = freeTitle(own.titles);
  }

  if (!id) {
    const fns = await findFunctions(admin);
    const data = await gql(admin, `#graphql
      mutation PerksDiscountCreate($input: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $input) {
          automaticAppDiscount { discountId }
          userErrors { field message }
        }
      }`, {
      input: {
        title,
        functionId: fns.discount!.id,
        startsAt: new Date().toISOString(),
        discountClasses: ["PRODUCT"],
        combinesWith: combinesWith(policy),
      },
    });
    assertNoUserErrors(data.discountAutomaticAppCreate, "discountAutomaticAppCreate");
    id = data.discountAutomaticAppCreate.automaticAppDiscount.discountId as string;
  } else {
    const data = await gql(admin, `#graphql
      mutation PerksDiscountUpdate($id: ID!, $input: DiscountAutomaticAppInput!) {
        discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {
          automaticAppDiscount { discountId }
          userErrors { field message }
        }
      }`, { id, input: { combinesWith: combinesWith(policy) } });
    assertNoUserErrors(data.discountAutomaticAppUpdate, "discountAutomaticAppUpdate");
  }

  await setMetafields(admin, ownerMetafields(id, functionConfig(policy, businesses), functionVars(businesses)));

  const on = policy.enabled && businesses.some((b) => b.active);
  const toggle = on ? "discountAutomaticActivate" : "discountAutomaticDeactivate";
  const t = await gql(admin, `#graphql
    mutation PerksDiscountToggle($id: ID!) {
      ${toggle}(id: $id) { userErrors { field message } }
    }`, { id });
  assertNoUserErrors(t[toggle], toggle);
  return id;
}

/**
 * The checkout rule is always on once set up. It only blocks carts with employee-only products,
 * and switching the program off must never make them buyable by everyone.
 */
export async function ensureValidation(admin: AdminClient, policy: BenefitPolicy, businesses: BusinessView[]) {
  let id: string | null = null;
  if (policy.validationId) {
    try {
      const data = await gql(admin, `#graphql
        mutation PerksValidationUpdate($id: ID!, $validation: ValidationUpdateInput!) {
          validationUpdate(id: $id, validation: $validation) {
            validation { id }
            userErrors { field message }
          }
        }`, { id: policy.validationId, validation: { enable: true, blockOnFailure: true, title: VALIDATION_TITLE } });
      if (data.validationUpdate?.validation?.id && !data.validationUpdate.userErrors?.length)
        id = data.validationUpdate.validation.id as string;
    } catch (err) {
      console.warn("[perks] validationUpdate failed, recreating", err);
    }
  }
  if (!id) {
    const fns = await findFunctions(admin);
    if (!fns.validation) throw new Error("Validation Function not deployed. Run `shopify app deploy` first.");
    const data = await gql(admin, `#graphql
      mutation PerksValidationCreate($validation: ValidationCreateInput!) {
        validationCreate(validation: $validation) {
          validation { id }
          userErrors { field message }
        }
      }`, { validation: { functionId: fns.validation.id, enable: true, blockOnFailure: true, title: VALIDATION_TITLE } });
    assertNoUserErrors(data.validationCreate, "validationCreate");
    id = data.validationCreate.validation.id as string;
  }
  const cfg = functionConfig(policy, businesses);
  // The validation only needs identity + employee-only targeting.
  const vcfg = { ...cfg, businesses: cfg.businesses.map((b) => ({ ...b, target: { ...b.target, all: false } })) };
  await setMetafields(admin, ownerMetafields(id, vcfg, functionVars(businesses)));
  return id;
}

export type EmployeeOnlyIndex = { businessId: string; handles: string[] }[];
export type DiscountedIndex = { businessId: string; handles: string[] }[];

/** App-data metafield read by the theme app embed. */
export async function publishStorefrontConfig(
  admin: AdminClient,
  policy: BenefitPolicy,
  businesses: BusinessView[],
  index: EmployeeOnlyIndex,
  discounted: DiscountedIndex = [],
) {
  const data = await gql(admin, `#graphql
    query PerksInstallation { currentAppInstallation { id } }`);
  const active = businesses.filter((b) => b.active);
  const value = {
    v: 2,
    enabled: policy.enabled,
    ui: themeOptions(parseStorefront(policy.storefront)),
    autoDomain: policy.autoDomain,
    excluded: parseJsonList(policy.excludedProducts).map((g) => g.split("/").pop()),
    businesses: active.map((b) => {
      const t = toFunctionTarget(b.discountTarget);
      return {
        id: b.id,
        domains: b.domains,
        type: b.discountType,
        value: b.discountValue,
        // numeric ids for Liquid comparisons
        target: { ...t, productIds: t.productIds.map((g) => g.split("/").pop()), collectionIds: t.collectionIds.map((g) => g.split("/").pop()) },
        employeeOnlyHandles: index.find((x) => x.businessId === b.id)?.handles ?? [],
        // For collection cards (not needed when the business discounts everything).
        discountedHandles: t.all ? [] : (discounted.find((x) => x.businessId === b.id)?.handles ?? []),
      };
    }),
  };
  await setMetafields(admin, [
    {
      ownerId: data.currentAppInstallation.id,
      namespace: STOREFRONT_NAMESPACE,
      key: STOREFRONT_KEY,
      type: "json",
      value: JSON.stringify(value),
    },
  ]);
}
