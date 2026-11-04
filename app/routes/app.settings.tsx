import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PageHelp } from "../components/ui";
import { merchantActor } from "../lib/admin-actor.server";
import type { AdminClient } from "../lib/admin-graphql.server";
import { gql } from "../lib/admin-graphql.server";
import { MONTHS_MAX, MONTHS_MIN, parseJsonList, parseSettingsForm } from "../lib/policy";
import { getSettings, saveSettings } from "../lib/settings.server";
import type { Ref } from "../lib/targeting";
import { authenticate } from "../shopify.server";

async function titles(admin: AdminClient, ids: string[]): Promise<Ref[]> {
  if (!ids.length) return [];
  const data = await gql<{ nodes: ({ id: string; title: string } | null)[] }>(admin, `#graphql
    query PerksExcludedTitles($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id title } } }`, { ids });
  const m = new Map(data.nodes.filter(Boolean).map((n) => [n!.id, n!.title]));
  return ids.map((id) => ({ id, title: m.get(id) ?? "Deleted product" }));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { policy } = await getSettings(session.shop);
  return {
    enabled: policy.enabled,
    autoDomain: policy.autoDomain,
    eligibilityMonths: policy.eligibilityMonths,
    combinesWithProduct: policy.combinesWithProduct,
    combinesWithOrder: policy.combinesWithOrder,
    combinesWithShipping: policy.combinesWithShipping,
    excluded: await titles(admin, parseJsonList(policy.excludedProducts)),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const parsed = parseSettingsForm(await request.formData());
  if (!parsed.ok) return { ok: false as const, error: Object.values(parsed.errors).join(" ") };
  try {
    await saveSettings(ctx.admin, ctx.session.shop, merchantActor(ctx), parsed.value);
    return { ok: true as const, error: null };
  } catch (err) {
    console.error("[perks] save settings failed", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Couldn't save" };
  }
};

const MONTHS = Array.from({ length: MONTHS_MAX - MONTHS_MIN + 1 }, (_, i) => i + MONTHS_MIN);

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const initial = useMemo(() => ({ ...data, eligibilityMonths: data.eligibilityMonths == null ? "none" : String(data.eligibilityMonths) }), [data]);
  const [s, setS] = useState(initial);
  useEffect(() => setS(initial), [initial]);
  const set = (p: Partial<typeof s>) => setS((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const saving = fetcher.state !== "idle";
  const checked = (k: keyof typeof s) => (e: Event) => set({ [k]: (e.currentTarget as unknown as { checked: boolean }).checked } as Partial<typeof s>);

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Settings saved");
    if (fetcher.data && !fetcher.data.ok) shopify.toast.show(fetcher.data.error ?? "Couldn't save", { isError: true });
  }, [fetcher.data, shopify]);

  const save = () => {
    const body: Record<string, string> = {
      eligibilityMonths: s.eligibilityMonths,
      excludedProducts: JSON.stringify(s.excluded.map((p) => p.id)),
    };
    for (const k of ["enabled", "autoDomain", "combinesWithProduct", "combinesWithOrder", "combinesWithShipping"] as const)
      if (s[k]) body[k] = "on";
    fetcher.submit(body, { method: "post" });
  };

  async function pickExcluded() {
    const selected = await shopify.resourcePicker({ type: "product", multiple: true, selectionIds: s.excluded.map((p) => ({ id: p.id })) });
    if (selected) set({ excluded: selected.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })) });
  }

  return (
    <s-page heading="Settings">
      <SaveBar id="settings-save-bar" open={dirty}>
        <button {...{ variant: "primary" }} onClick={save} {...(saving ? { loading: "" } : {})}></button>
        <button onClick={() => setS(initial)}></button>
      </SaveBar>
      <s-stack gap="base">
        <PageHelp title="Store-wide settings">
          These apply to every business. Discounts, products and limits are set per business on the{" "}
          <s-link href="/app/businesses">Businesses</s-link> page.
        </PageHelp>

        <s-section heading="Program">
          <s-switch
            label="Employee perks are on"
            details="When off, nobody gets employee discounts. Employee-only products stay protected either way."
            checked={s.enabled}
            onChange={checked("enabled")}
          />
        </s-section>

        <s-section heading="Who gets perks">
          <s-stack gap="base">
            <s-checkbox
              label="Automatically give perks to customers who log in with a work email"
              details="Shopify confirms the email with a login code, so it can't be faked. Turn off to require every employee to verify by email link."
              checked={s.autoDomain}
              onChange={checked("autoDomain")}
            />
            <s-select
              label="Email-link verifications stay active for"
              details="For employees who verified a work email while shopping with a personal account."
              value={s.eligibilityMonths}
              onChange={(e) => set({ eligibilityMonths: (e.currentTarget as unknown as { value: string }).value })}
            >
              {MONTHS.map((m) => (
                <s-option key={m} value={String(m)}>
                  {m} {m === 1 ? "month" : "months"}
                </s-option>
              ))}
              <s-option value="none">Never expire</s-option>
            </s-select>
          </s-stack>
        </s-section>

        <s-section heading="Never discounted">
          <s-stack gap="base">
            <s-paragraph>Employee discounts never apply to these products, for any business.</s-paragraph>
            {s.excluded.length ? (
              <s-stack direction="inline" gap="small-200">
                {s.excluded.map((p) => (
                  <s-clickable-chip key={p.id} removable onRemove={() => set({ excluded: s.excluded.filter((x) => x.id !== p.id) })}>
                    {p.title}
                  </s-clickable-chip>
                ))}
              </s-stack>
            ) : (
              <s-text color="subdued">No exclusions.</s-text>
            )}
            <s-box>
              <s-button icon="product" onClick={pickExcluded}>
                Choose products
              </s-button>
            </s-box>
          </s-stack>
        </s-section>

        <s-section heading="Combining with other discounts">
          <s-stack gap="small">
            <s-paragraph>By default the employee discount doesn&apos;t stack; Shopify applies the better discount.</s-paragraph>
            <s-checkbox label="Other product discounts" checked={s.combinesWithProduct} onChange={checked("combinesWithProduct")} />
            <s-checkbox label="Order discounts" checked={s.combinesWithOrder} onChange={checked("combinesWithOrder")} />
            <s-checkbox label="Shipping discounts" checked={s.combinesWithShipping} onChange={checked("combinesWithShipping")} />
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
