/**
 * Creates/updates the Shopify objects the app owns:
 * - an automatic app discount backed by the perks-discount Function
 * - a cart & checkout validation (checkout rule) backed by the perks-validation Function
 * - an app-data metafield the theme embed reads (app.metafields.perks.storefront)
 */
import type { BenefitPolicy } from "@prisma/client";
import type { AdminClient } from "./admin-graphql.server";
import { assertNoUserErrors, gql } from "./admin-graphql.server";
import { DISCOUNT_CONFIG_KEY, ELIGIBILITY_NAMESPACE, STOREFRONT_KEY, STOREFRONT_NAMESPACE } from "./eligibility";
import { setMetafields } from "./metafields.server";
import { normalizeScope, parseJsonList } from "./policy";

export const DISCOUNT_TITLE = "Employee perks";
export const VALIDATION_TITLE = "Employee-only products";

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

type PolicyLike = Pick<BenefitPolicy, "discountPercent" | "discountScope" | "autoDomain">;

/** Config read by both Functions. Domains are needed for auto-eligibility by account email. */
export function eligibilityConfig(policy: Pick<BenefitPolicy, "autoDomain">, domains: string[]) {
  return { v: 1 as const, autoDomain: policy.autoDomain, domains };
}

export function discountConfig(policy: PolicyLike, domains: string[]) {
  return {
    ...eligibilityConfig(policy, domains),
    percent: policy.discountPercent,
    scope: normalizeScope(policy.discountScope),
  };
}

export function storefrontConfig(policy: BenefitPolicy, domains: string[]) {
  return {
    v: 1,
    enabled: policy.enabled,
    autoDomain: policy.autoDomain,
    domains,
    percent: policy.discountPercent,
    allProducts: normalizeScope(policy.discountScope) === "all_products",
    employeeOnlyHandles: parseJsonList(policy.employeeOnlyHandles),
  };
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

/** Returns the discount node GID. */
export async function ensureDiscount(admin: AdminClient, policy: BenefitPolicy, domains: string[]): Promise<string> {
  let id = policy.discountId && (await discountExists(admin, policy.discountId)) ? policy.discountId : null;

  if (!id) {
    const fns = await findFunctions(admin);
    if (!fns.discount) throw new Error("Discount Function not deployed. Run `shopify app dev` or deploy first.");
    const data = await gql(admin, `#graphql
      mutation PerksDiscountCreate($input: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $input) {
          automaticAppDiscount { discountId }
          userErrors { field message }
        }
      }`, {
      input: {
        title: DISCOUNT_TITLE,
        functionId: fns.discount.id,
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
      }`, { id, input: { title: DISCOUNT_TITLE, combinesWith: combinesWith(policy) } });
    assertNoUserErrors(data.discountAutomaticAppUpdate, "discountAutomaticAppUpdate");
  }

  await setMetafields(admin, [
    {
      ownerId: id,
      namespace: ELIGIBILITY_NAMESPACE,
      key: DISCOUNT_CONFIG_KEY,
      type: "json",
      value: JSON.stringify(discountConfig(policy, domains)),
    },
  ]);

  const toggle = policy.enabled ? "discountAutomaticActivate" : "discountAutomaticDeactivate";
  const t = await gql(admin, `#graphql
    mutation PerksDiscountToggle($id: ID!) {
      ${toggle}(id: $id) { userErrors { field message } }
    }`, { id });
  assertNoUserErrors(t[toggle], toggle);
  return id;
}

/**
 * The checkout rule is always on once set up. It only blocks carts that contain employee-only
 * products, so it's harmless with none selected, and switching the program off must never make
 * employee-only products buyable by everyone.
 */
export async function ensureValidation(admin: AdminClient, policy: BenefitPolicy, domains: string[]) {
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
    if (!fns.validation) throw new Error("Validation Function not deployed. Run `shopify app dev` or deploy first.");
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
  await setMetafields(admin, [
    {
      ownerId: id,
      namespace: ELIGIBILITY_NAMESPACE,
      key: DISCOUNT_CONFIG_KEY,
      type: "json",
      value: JSON.stringify(eligibilityConfig(policy, domains)),
    },
  ]);
  return id;
}

/** App-data metafield read by the theme app embed. */
export async function publishStorefrontConfig(admin: AdminClient, policy: BenefitPolicy, domains: string[]) {
  const data = await gql(admin, `#graphql
    query PerksInstallation { currentAppInstallation { id } }`);
  await setMetafields(admin, [
    {
      ownerId: data.currentAppInstallation.id,
      namespace: STOREFRONT_NAMESPACE,
      key: STOREFRONT_KEY,
      type: "json",
      value: JSON.stringify(storefrontConfig(policy, domains)),
    },
  ]);
}
