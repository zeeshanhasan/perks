import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PageHelp } from "../components/ui";
import { merchantActor } from "../lib/admin-actor.server";
import type { AdminClient } from "../lib/admin-graphql.server";
import { gql } from "../lib/admin-graphql.server";
import { normalizeScope, parseJsonList, parseProductIds } from "../lib/policy";
import { getSettings, saveProducts } from "../lib/settings.server";
import { authenticate } from "../shopify.server";

type P = { id: string; title: string; image: string | null };
type ListKey = "employeeOnly" | "discounted" | "excluded";

async function details(admin: AdminClient, ids: string[]): Promise<P[]> {
  if (!ids.length) return [];
  const data = await gql<{ nodes: ({ id: string; title: string; featuredMedia?: { preview?: { image?: { url?: string } } } } | null)[] }>(
    admin,
    `#graphql
    query PerksProductDetails($ids: [ID!]!) {
      nodes(ids: $ids) { ... on Product { id title featuredMedia { preview { image { url(transform: { maxWidth: 80 }) } } } } }
    }`,
    { ids },
  );
  const found = new Map(data.nodes.filter(Boolean).map((n) => [n!.id, n!]));
  return ids.map((id) => {
    const n = found.get(id);
    return { id, title: n?.title ?? "Deleted product", image: n?.featuredMedia?.preview?.image?.url ?? null };
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { policy } = await getSettings(session.shop);
  const [employeeOnly, discounted, excluded] = await Promise.all([
    details(admin, parseJsonList(policy.employeeOnlyProducts)),
    details(admin, parseJsonList(policy.discountedProducts)),
    details(admin, parseJsonList(policy.excludedProducts)),
  ]);
  return {
    lists: { employeeOnly, discounted, excluded },
    scope: normalizeScope(policy.discountScope),
    percent: policy.discountPercent,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const form = await request.formData();
  try {
    await saveProducts(ctx.admin, ctx.session.shop, merchantActor(ctx), {
      employeeOnly: parseProductIds(form.get("employeeOnly")),
      discounted: parseProductIds(form.get("discounted")),
      excluded: parseProductIds(form.get("excluded")),
    });
    return { ok: true as const, error: null };
  } catch (err) {
    console.error("[perks] save products failed", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Couldn't save" };
  }
};

const ids = (l: P[]) => l.map((p) => p.id).join(",");

function ProductTable({ items, onRemove, empty }: { items: P[]; onRemove: (id: string) => void; empty: string }) {
  if (!items.length)
    return (
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-text color="subdued">{empty}</s-text>
      </s-box>
    );
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header>Product</s-table-header>
        <s-table-header>
          <s-text accessibilityVisibility="exclusive">Actions</s-text>
        </s-table-header>
      </s-table-header-row>
      <s-table-body>
        {items.map((p) => (
          <s-table-row key={p.id}>
            <s-table-cell>
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-thumbnail src={p.image ?? undefined} alt={p.title} size="small" />
                <s-text>{p.title}</s-text>
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="inline" justifyContent="end">
                <s-button variant="tertiary" icon="x" accessibilityLabel={`Remove ${p.title}`} onClick={() => onRemove(p.id)} />
              </s-stack>
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

export default function Products() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [lists, setLists] = useState(data.lists);
  const saving = fetcher.state !== "idle";

  // Reset local state after a successful save reloads the data.
  useEffect(() => setLists(data.lists), [data.lists]);

  const dirty = useMemo(
    () => (Object.keys(lists) as ListKey[]).some((k) => ids(lists[k]) !== ids(data.lists[k])),
    [lists, data.lists],
  );

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Products saved");
    if (fetcher.data && !fetcher.data.ok) shopify.toast.show(fetcher.data.error ?? "Couldn't save", { isError: true });
  }, [fetcher.data, shopify]);

  async function pick(key: ListKey) {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: lists[key].map((p) => ({ id: p.id })),
    });
    if (!selected) return;
    const picked: P[] = selected.map((p: { id: string; title: string; images?: { originalSrc?: string }[] }) => ({
      id: p.id,
      title: p.title,
      image: p.images?.[0]?.originalSrc ?? null,
    }));
    setLists((prev) => {
      const next = { ...prev, [key]: picked };
      // Employee-only and "discounted for employees" are mutually exclusive.
      if (key === "employeeOnly") next.discounted = prev.discounted.filter((p) => !picked.some((x) => x.id === p.id));
      if (key === "discounted") next.employeeOnly = prev.employeeOnly.filter((p) => !picked.some((x) => x.id === p.id));
      return next;
    });
  }

  const remove = (key: ListKey) => (id: string) =>
    setLists((prev) => ({ ...prev, [key]: prev[key].filter((p) => p.id !== id) }));

  const save = () =>
    fetcher.submit(
      {
        employeeOnly: JSON.stringify(lists.employeeOnly.map((p) => p.id)),
        discounted: JSON.stringify(lists.discounted.map((p) => p.id)),
        excluded: JSON.stringify(lists.excluded.map((p) => p.id)),
      },
      { method: "post" },
    );

  return (
    <s-page heading="Products">
      <SaveBar id="products-save-bar" open={dirty}>
        {/* ui-save-bar buttons: labels are provided by Shopify ("Save" / "Discard"). */}
        <button {...{ variant: "primary" }} onClick={save} {...(saving ? { loading: "" } : {})}></button>
        <button onClick={() => setLists(data.lists)}></button>
      </SaveBar>

      <s-stack gap="base">
        <PageHelp title="Choosing products">
          <strong>Employee-only</strong> products can only be bought by employees, and employees get the discount on
          them. <strong>Discounted for employees</strong> products can be bought by anyone, but only employees get the
          discount. <strong>Never discounted</strong> overrides both. Remember to click Save.
        </PageHelp>

        {data.scope === "all_products" ? (
          <s-banner tone="info" heading={`The ${data.percent}% discount applies to all products`}>
            You don&apos;t need the &ldquo;Discounted for employees&rdquo; list. Change this in{" "}
            <s-link href="/app/settings">Settings</s-link>.
          </s-banner>
        ) : null}

        <s-section heading="Employee-only products">
          <s-stack gap="base">
            <s-paragraph>
              Only employees can check out with these. Other shoppers see a message at checkout. With Employee mode on
              in your theme, other shoppers won&apos;t see them in collections either.
            </s-paragraph>
            <ProductTable
              items={lists.employeeOnly}
              onRemove={remove("employeeOnly")}
              empty="No employee-only products yet."
            />
            <s-box>
              <s-button icon="product-add" onClick={() => pick("employeeOnly")}>
                Choose products
              </s-button>
            </s-box>
          </s-stack>
        </s-section>

        {data.scope === "selected" ? (
          <s-section heading="Discounted for employees">
            <s-stack gap="base">
              <s-paragraph>
                Anyone can buy these at the normal price. Employees get {data.percent}% off.
              </s-paragraph>
              <ProductTable
                items={lists.discounted}
                onRemove={remove("discounted")}
                empty="No discounted products yet."
              />
              <s-box>
                <s-button icon="product-add" onClick={() => pick("discounted")}>
                  Choose products
                </s-button>
              </s-box>
            </s-stack>
          </s-section>
        ) : null}

        <s-section heading="Never discounted">
          <s-stack gap="base">
            <s-paragraph>
              The employee discount never applies to these, even if they&apos;re in a list above. Employee-only
              products here can still only be bought by employees.
            </s-paragraph>
            <ProductTable items={lists.excluded} onRemove={remove("excluded")} empty="No exclusions." />
            <s-box>
              <s-button icon="product-add" onClick={() => pick("excluded")}>
                Choose products
              </s-button>
            </s-box>
          </s-stack>
        </s-section>

        <s-stack direction="inline" justifyContent="end">
          <s-button variant="primary" onClick={save} disabled={!dirty} {...(saving ? { loading: true } : {})}>
            Save
          </s-button>
        </s-stack>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
