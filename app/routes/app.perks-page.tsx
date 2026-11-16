import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { RouteError } from "../components/RouteError";
import { PageHelp } from "../components/ui";
import { useSaveBar } from "../components/useSaveBar";
import { merchantActor } from "../lib/admin-actor.server";
import { describeDiscount } from "../lib/business";
import { listBusinesses } from "../lib/business.server";
import { shopInfo } from "../lib/catalog.server";
import type { StorefrontOptions } from "../lib/storefront";
import { STOREFRONT_DEFAULTS, STOREFRONT_LIMITS, storefrontFromForm } from "../lib/storefront";
import { getStorefront, saveStorefront } from "../lib/storefront.server";
import { authenticate } from "../shopify.server";

// The public perks page (/apps/perks on the store): its own page in the app, split out of Storefront.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const [options, businesses, policy, info] = await Promise.all([
    getStorefront(shop),
    listBusinesses(shop),
    db.benefitPolicy.findUnique({ where: { shop }, select: { enabled: true } }),
    shopInfo(admin, shop),
  ]);
  return {
    options,
    programOn: Boolean(policy?.enabled),
    perksUrl: `https://${shop}/apps/perks`,
    menuUrl: `https://${shop}/admin/menus`, // Shopify redirects this to Online Store → Navigation
    listed: businesses
      .filter((b) => b.active)
      .map((b) => ({ id: b.id, name: b.name, discount: describeDiscount(b, info.currency), domains: b.domains })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  try {
    await saveStorefront(ctx.admin, ctx.session.shop, merchantActor(ctx), storefrontFromForm(await request.formData()));
    return { ok: true as const, error: null };
  } catch (err) {
    console.error("[perks] save perks page failed", err);
    return { ok: false as const, error: "Couldn't save. Try again." };
  }
};

const SAVE_BAR_ID = "perks-page-save-bar";

export default function PerksPage() {
  const { options, programOn, perksUrl, menuUrl, listed } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  useSaveBar(SAVE_BAR_ID);
  const initial = useMemo(() => options, [options]);
  const [o, setO] = useState<StorefrontOptions>(initial);
  useEffect(() => setO(initial), [initial]);
  const set = (p: Partial<StorefrontOptions>) => setO((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(o) !== JSON.stringify(initial);
  const saving = fetcher.state !== "idle";
  const live = options.perksPage && programOn;

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Perks page saved");
    else if (fetcher.data?.error) shopify.toast.show(fetcher.data.error, { isError: true });
  }, [fetcher.data, shopify]);

  const save = () => {
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) body[k] = typeof v === "boolean" ? (v ? "on" : "off") : v;
    fetcher.submit(body, { method: "post" });
  };
  const checked = (e: Event) => (e.currentTarget as unknown as { checked: boolean }).checked;
  const text = (k: "perksPageTitle" | "perksPageIntro", label: string, area = false) => {
    const props = {
      label,
      value: o[k],
      maxLength: STOREFRONT_LIMITS[k],
      placeholder: STOREFRONT_DEFAULTS[k],
      onInput: (e: Event) => set({ [k]: (e.currentTarget as unknown as { value: string }).value }),
    };
    return area ? <s-text-area {...props} rows={3} /> : <s-text-field {...props} />;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(perksUrl);
      shopify.toast.show("Link copied");
    } catch {
      shopify.toast.show("Couldn't copy. Select the address and copy it.", { isError: true });
    }
  };

  return (
    <s-page heading="Perks page">
      <SaveBar id={SAVE_BAR_ID} open={dirty}>
        <button {...{ variant: "primary" }} onClick={save} {...(saving ? { loading: "" } : {})}></button>
        <button onClick={() => setO(initial)}></button>
      </SaveBar>

      <s-stack gap="base">
        {options.perksPage && !programOn ? (
          <s-banner tone="warning" heading="The page shows “Not available right now”">
            Employee perks are switched off in <s-link href="/app/settings">Settings</s-link>, so the page tells visitors to
            check back later.
          </s-banner>
        ) : null}

        <s-section heading="Page">
          <s-badge slot="accessory" tone={live ? "success" : "neutral"}>
            {live ? "Live" : "Off"}
          </s-badge>
          <s-stack gap="base">
            <s-paragraph>
              A page on your store that lists your partner companies and their discounts, so employees can see what they get
              and how to claim it.
            </s-paragraph>
            <s-switch label="Show the perks page on my store" checked={o.perksPage} onChange={(e) => set({ perksPage: checked(e) })} />
            <s-grid gridTemplateColumns="1fr auto auto" gap="small" alignItems="center">
              <s-text color="subdued">{perksUrl}</s-text>
              <s-button icon="clipboard" onClick={copy}>
                Copy link
              </s-button>
              <s-button
                icon="external"
                disabled={!options.perksPage}
                onClick={() => window.open(perksUrl, "_blank", "noopener,noreferrer")}
              >
                View page
              </s-button>
            </s-grid>
            {o.perksPage && !options.perksPage ? <s-text color="subdued">Save to publish the page.</s-text> : null}
          </s-stack>
        </s-section>

        <s-section heading="Content">
          <s-stack gap="base">
            {text("perksPageTitle", "Title")}
            {text("perksPageIntro", "Intro", true)}
            <s-checkbox
              label="Show each company's work email domains"
              details="Helps employees see if their email qualifies, e.g. @acme.com."
              checked={o.perksPageDomains}
              onChange={(e) => set({ perksPageDomains: checked(e) })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Companies on the page">
          <s-stack gap="base">
            <s-text color="subdued">Active businesses are listed. Paused ones are hidden until you switch them back on.</s-text>
            {listed.length ? (
              <s-box padding="base" border="base" borderRadius="base">
                <s-stack gap="small">
                  <s-text type="strong">{o.perksPageTitle || STOREFRONT_DEFAULTS.perksPageTitle}</s-text>
                  <s-text color="subdued">{o.perksPageIntro || STOREFRONT_DEFAULTS.perksPageIntro}</s-text>
                  <s-grid gridTemplateColumns="repeat(auto-fill, minmax(180px, 1fr))" gap="small">
                    {listed.map((b) => (
                      <s-box key={b.id} padding="small" border="base" borderRadius="base">
                        <s-stack gap="small-300">
                          <s-text type="strong">{b.name}</s-text>
                          <s-text>{b.discount}</s-text>
                          {o.perksPageDomains && b.domains.length ? (
                            <s-text color="subdued">{b.domains.map((d) => `@${d}`).join(", ")}</s-text>
                          ) : null}
                        </s-stack>
                      </s-box>
                    ))}
                  </s-grid>
                </s-stack>
              </s-box>
            ) : (
              <s-text color="subdued">
                No active businesses yet. <s-link href="/app/businesses">Add or switch on a business</s-link> to list it.
              </s-text>
            )}
          </s-stack>
        </s-section>

        <PageHelp title="Add it to your store menu">
          Shoppers only find the page if you link to it. In Shopify, open Online Store, then{" "}
          <s-link href={menuUrl} target="_blank">
            Navigation
          </s-link>
          , pick your main or footer menu, add a menu item and paste the page link.
        </PageHelp>
      </s-stack>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Perks page" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
