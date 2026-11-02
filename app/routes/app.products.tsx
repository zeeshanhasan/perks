import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { merchantActor } from "../lib/admin-actor.server";
import { gql } from "../lib/admin-graphql.server";
import { parseJsonList, parseProductIds } from "../lib/policy";
import { getSettings, saveProducts } from "../lib/settings.server";
import { authenticate } from "../shopify.server";

type P = { id: string; title: string };

async function titles(admin: Parameters<typeof gql>[0], ids: string[]): Promise<P[]> {
  if (!ids.length) return [];
  const data = await gql<{ nodes: ({ id: string; title: string } | null)[] }>(
    admin,
    `#graphql
    query PerksProductTitles($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id title } } }`,
    { ids },
  );
  const found = new Map(data.nodes.filter(Boolean).map((n) => [n!.id, n!.title]));
  return ids.map((id) => ({ id, title: found.get(id) ?? "(deleted product)" }));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { policy } = await getSettings(session.shop);
  const [employeeOnly, excluded] = await Promise.all([
    titles(admin, parseJsonList(policy.employeeOnlyProducts)),
    titles(admin, parseJsonList(policy.excludedProducts)),
  ]);
  return { employeeOnly, excluded };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const form = await request.formData();
  const employeeOnly = parseProductIds(form.get("employeeOnly"));
  const excluded = parseProductIds(form.get("excluded"));
  try {
    await saveProducts(ctx.admin, ctx.session.shop, merchantActor(ctx), employeeOnly, excluded);
    return { ok: true as const, error: null };
  } catch (err) {
    console.error("[perks] save products failed", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Couldn't save" };
  }
};

function ProductList({ items, onRemove }: { items: P[]; onRemove: (id: string) => void }) {
  if (!items.length) return <s-paragraph>None selected.</s-paragraph>;
  return (
    <s-unordered-list>
      {items.map((p) => (
        <s-list-item key={p.id}>
          {p.title}{" "}
          <s-button variant="tertiary" onClick={() => onRemove(p.id)}>
            Remove
          </s-button>
        </s-list-item>
      ))}
    </s-unordered-list>
  );
}

export default function Products() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [employeeOnly, setEmployeeOnly] = useState<P[]>(data.employeeOnly);
  const [excluded, setExcluded] = useState<P[]>(data.excluded);

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Products saved");
    if (fetcher.data && !fetcher.data.ok) shopify.toast.show(fetcher.data.error ?? "Error", { isError: true });
  }, [fetcher.data, shopify]);

  async function pick(current: P[], set: (p: P[]) => void) {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: current.map((p) => ({ id: p.id })),
    });
    if (selected) set(selected.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })));
  }

  const save = () =>
    fetcher.submit(
      {
        employeeOnly: JSON.stringify(employeeOnly.map((p) => p.id)),
        excluded: JSON.stringify(excluded.map((p) => p.id)),
      },
      { method: "post" },
    );

  return (
    <s-page heading="Products">
      <s-button slot="primary-action" variant="primary" onClick={save} {...(fetcher.state !== "idle" ? { loading: true } : {})}>
        Save
      </s-button>

      <s-section heading="Employee-only products">
        <s-paragraph>
          Only verified employees can check out with these. Others are blocked at checkout. Tip: also put them in a
          collection you link from your menu.
        </s-paragraph>
        <ProductList items={employeeOnly} onRemove={(id) => setEmployeeOnly(employeeOnly.filter((p) => p.id !== id))} />
        <s-button onClick={() => pick(employeeOnly, setEmployeeOnly)}>Select products</s-button>
      </s-section>

      <s-section heading="Excluded from the discount">
        <s-paragraph>The employee discount never applies to these.</s-paragraph>
        <ProductList items={excluded} onRemove={(id) => setExcluded(excluded.filter((p) => p.id !== id))} />
        <s-button onClick={() => pick(excluded, setExcluded)}>Select products</s-button>
      </s-section>

      <s-section slot="aside" heading="Limitations">
        <s-paragraph>
          Employee-only products can still appear in theme search and direct links. Checkout is where they are enforced.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
