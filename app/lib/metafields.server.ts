import type { AdminClient } from "./admin-graphql.server";
import { assertNoUserErrors, gql } from "./admin-graphql.server";
import type { EligibilityValue } from "./eligibility";
import {
  DISCOUNT_EXCLUDED_KEY,
  ELIGIBILITY_KEY,
  ELIGIBILITY_NAMESPACE,
  EMPLOYEE_ONLY_KEY,
} from "./eligibility";

const SET = `#graphql
  mutation PerksMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }`;

const DELETE = `#graphql
  mutation PerksMetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields { key }
      userErrors { field message }
    }
  }`;

type SetInput = { ownerId: string; namespace: string; key: string; type: string; value: string };
type DeleteInput = { ownerId: string; namespace: string; key: string };

function chunks<T>(list: T[], size = 25): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function setMetafields(admin: AdminClient, inputs: SetInput[]) {
  for (const batch of chunks(inputs)) {
    const data = await gql(admin, SET, { metafields: batch });
    assertNoUserErrors(data.metafieldsSet, "metafieldsSet");
  }
}

export async function deleteMetafields(admin: AdminClient, inputs: DeleteInput[]) {
  for (const batch of chunks(inputs)) {
    const data = await gql(admin, DELETE, { metafields: batch });
    assertNoUserErrors(data.metafieldsDelete, "metafieldsDelete");
  }
}

export const customerGid = (customerId: string) => `gid://shopify/Customer/${customerId}`;

export async function publishEligibility(admin: AdminClient, customerId: string, value: EligibilityValue) {
  await setMetafields(admin, [
    {
      ownerId: customerGid(customerId),
      namespace: ELIGIBILITY_NAMESPACE,
      key: ELIGIBILITY_KEY,
      type: "json",
      value: JSON.stringify(value),
    },
  ]);
}

export async function clearEligibility(admin: AdminClient, customerId: string) {
  await deleteMetafields(admin, [
    { ownerId: customerGid(customerId), namespace: ELIGIBILITY_NAMESPACE, key: ELIGIBILITY_KEY },
  ]);
}

/** Diff-based sync of a boolean product flag. */
export async function syncProductFlag(admin: AdminClient, key: string, previous: string[], next: string[]) {
  const add = next.filter((id) => !previous.includes(id));
  const remove = previous.filter((id) => !next.includes(id));
  if (add.length)
    await setMetafields(
      admin,
      add.map((ownerId) => ({ ownerId, namespace: ELIGIBILITY_NAMESPACE, key, type: "boolean", value: "true" })),
    );
  if (remove.length)
    await deleteMetafields(
      admin,
      remove.map((ownerId) => ({ ownerId, namespace: ELIGIBILITY_NAMESPACE, key })),
    );
}

export const syncEmployeeOnly = (admin: AdminClient, prev: string[], next: string[]) =>
  syncProductFlag(admin, EMPLOYEE_ONLY_KEY, prev, next);
export const syncDiscountExcluded = (admin: AdminClient, prev: string[], next: string[]) =>
  syncProductFlag(admin, DISCOUNT_EXCLUDED_KEY, prev, next);
