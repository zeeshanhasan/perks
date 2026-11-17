import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { PageHelp } from "../components/ui";
import { useSaveBar } from "../components/useSaveBar";
import { merchantActor } from "../lib/admin-actor.server";
import type { AdminClient } from "../lib/admin-graphql.server";
import { gql } from "../lib/admin-graphql.server";
import { parseJsonList, parseSettingsForm } from "../lib/policy";
import { getSettings, saveSettings } from "../lib/settings.server";
import type { Ref } from "../lib/targeting";
import { authenticate } from "../shopify.server";
import { checkBilling } from "../lib/billing.server";
import { PRICES, type Tier } from "../lib/billing";

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
  const billing = await checkBilling(admin, session.shop);
  const plan =
    billing.billing && billing.subscription
      ? {
          tier: billing.state.kind === "ok" ? billing.state.tier : null,
          trialEndsAt: billing.subscription.trialEndsAt,
          yearly: billing.subscription.billingPeriod === "ANNUAL",
          amount: billing.subscription.amount,
          cancelling: billing.subscription.cancelAtEndOfCycle,
          url: billing.planUrl,
        }
      : null;
  return {
    plan,
    enabled: policy.enabled,
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

type Plan = { tier: Tier | null; trialEndsAt: string | null; yearly: boolean; cancelling: boolean; url: string; amount: number | null };

/** The store's plan (decision 017). Shopify hosts the page where it's changed or cancelled. */
function PlanSection({ plan }: { plan: Plan }) {
  const p = plan.tier ? PRICES[plan.tier] : null;
  const trial = plan.trialEndsAt && new Date(plan.trialEndsAt) > new Date() ? new Date(plan.trialEndsAt) : null;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const per = plan.yearly ? "year" : "month";
  // Private plans show what Shopify charges; Basic/Standard show the list price (dev stores are $0 but still "Basic").
  const price = p
    ? plan.yearly ? `$${p.yearly}/year` : `$${p.monthly}/month`
    : plan.amount === 0 ? "Free" : plan.amount ? `$${plan.amount}/${per}` : null;
  return (
    <s-section heading="Plan">
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{p ? p.name : "Private plan"}</s-text>
          {price ? <s-text color="subdued">{price}</s-text> : null}
          {trial ? <s-badge tone="info">Free trial until {fmt(trial)}</s-badge> : null}
          {plan.cancelling ? <s-badge tone="warning">Ends at the end of this billing cycle</s-badge> : null}
        </s-stack>
        <s-text color="subdued">Every feature is included. Billed by Shopify on your Shopify invoice.</s-text>
        <s-box>
          <s-button onClick={() => window.open(plan.url, "_top")}>Manage plan</s-button>
        </s-box>
      </s-stack>
    </s-section>
  );
}

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const initial = useMemo(() => ({ ...data }), [data]);
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
  useSaveBar("settings-save-bar");

  const save = () => {
    const body: Record<string, string> = { excludedProducts: JSON.stringify(s.excluded.map((p) => p.id)) };
    for (const k of ["enabled", "combinesWithProduct", "combinesWithOrder", "combinesWithShipping"] as const)
      if (s[k]) body[k] = "on";
    fetcher.submit(body, { method: "post" });
  };

  async function pickExcluded() {
    const selected = await shopify.resourcePicker({ type: "product", multiple: true, selectionIds: s.excluded.map((p) => ({ id: p.id })) });
    if (selected) set({ excluded: selected.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })) });
  }

  return (
    <s-page heading="Settings">
      <s-button slot="secondary-actions" href="/app/audit">
        Activity log
      </s-button>
      <s-button slot="secondary-actions" href="/app/help">
        Help
      </s-button>
      <SaveBar id="settings-save-bar" open={dirty}>
        <button {...{ variant: "primary" }} onClick={save} {...(saving ? { loading: "" } : {})}></button>
        <button onClick={() => setS(initial)}></button>
      </SaveBar>
      <s-stack gap="base">
        {data.plan ? <PlanSection plan={data.plan} /> : null}
        <s-section heading="Pause all perks">
          <s-switch
            label="Employee perks are on"
            details="Switch off to stop every employee discount at once, for example during a store-wide sale. Each business keeps its settings, and employee-only products stay protected."
            checked={s.enabled}
            onChange={checked("enabled")}
          />
        </s-section>

        <s-section heading="Never discounted">
          <s-stack gap="base">
            <s-paragraph>
              These products never get an employee discount, for any business. Use it for items that are already on sale or
              have a small margin. Gift cards are never discounted anyway.
            </s-paragraph>
            {s.excluded.length ? (
              <s-stack direction="inline" gap="small-200">
                {s.excluded.map((p) => (
                  <s-clickable-chip key={p.id} removable onRemove={() => set({ excluded: s.excluded.filter((x) => x.id !== p.id) })}>
                    {p.title}
                  </s-clickable-chip>
                ))}
              </s-stack>
            ) : (
              <s-text color="subdued">No products excluded.</s-text>
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
            <s-paragraph>
              Can an employee use their discount together with your other discounts? If not ticked, Shopify gives them
              whichever discount is better, not both.
            </s-paragraph>
            <s-checkbox
              label="Other product discounts"
              details="e.g. a 20% sale on a collection: employees get the sale and their discount"
              checked={s.combinesWithProduct}
              onChange={checked("combinesWithProduct")}
            />
            <s-checkbox
              label="Order discounts"
              details="e.g. 10% off orders over a certain amount"
              checked={s.combinesWithOrder}
              onChange={checked("combinesWithOrder")}
            />
            <s-checkbox
              label="Shipping discounts"
              details="e.g. free shipping"
              checked={s.combinesWithShipping}
              onChange={checked("combinesWithShipping")}
            />
          </s-stack>
        </s-section>

        <PageHelp title="Store-wide settings">
          These apply to every business. Discounts, products and limits are set per business on the{" "}
          <s-link href="/app/businesses">Businesses</s-link> page. Employees get perks as soon as they log in with a work
          email.
        </PageHelp>
      </s-stack>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Settings" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
