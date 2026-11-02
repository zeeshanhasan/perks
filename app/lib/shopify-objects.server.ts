/**
 * Creates/updates the Shopify objects the app owns:
 * - an automatic app discount backed by the perks-discount Function
 * - a cart & checkout validation backed by the perks-validation Function
 */
import type { BenefitPolicy } from "@prisma/client";
import type { AdminClient } from "./admin-graphql.server";
import { assertNoUserErrors, gql } from "./admin-graphql.server";
import { DISCOUNT_CONFIG_KEY, ELIGIBILITY_NAMESPACE } from "./eligibility";
import { setMetafields } from "./metafields.server";

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

export type DiscountConfig = { v: 1; percent: number; scope: "employee_only" | "all_products" };

export function discountConfig(policy: Pick<BenefitPolicy, "discountPercent" | "discountScope">): DiscountConfig {
  return {
    v: 1,
    percent: policy.discountPercent,
    scope: policy.discountScope === "all_products" ? "all_products" : "employee_only",
  };
}

const combinesWith = (p: BenefitPolicy) => ({
  productDiscounts: p.combinesWithProduct,
  orderDiscounts: p.combinesWithOrder,
  shippingDiscounts: p.combinesWithShipping,
});

async function discountExists(admin: AdminClient, id: string): Promise<boolean> {
  const data = await gql(admin, `#graphql
    query PerksDiscountNode($id: ID!) { discountNode(id: $id) { id } }`, { id });
  return Boolean(data.discountNode);
}

/** Returns the discount node GID. */
export async function ensureDiscount(admin: AdminClient, policy: BenefitPolicy): Promise<string> {
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
      value: JSON.stringify(discountConfig(policy)),
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
 * The validation stays enabled whenever there are employee-only products, even if the program
 * is switched off: switching off must never make employee-only products buyable by everyone.
 */
export async function ensureValidation(admin: AdminClient, policy: BenefitPolicy, hasEmployeeOnly: boolean) {
  const enable = hasEmployeeOnly;
  if (policy.validationId) {
    try {
      const data = await gql(admin, `#graphql
        mutation PerksValidationUpdate($id: ID!, $validation: ValidationUpdateInput!) {
          validationUpdate(id: $id, validation: $validation) {
            validation { id }
            userErrors { field message }
          }
        }`, { id: policy.validationId, validation: { enable, blockOnFailure: true, title: VALIDATION_TITLE } });
      if (data.validationUpdate?.validation?.id && !data.validationUpdate.userErrors?.length)
        return data.validationUpdate.validation.id as string;
    } catch (err) {
      console.warn("[perks] validationUpdate failed, recreating", err);
    }
    // fall through: it was deleted, recreate
  }
  if (!enable) return policy.validationId ?? null;
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
  return data.validationCreate.validation.id as string;
}
