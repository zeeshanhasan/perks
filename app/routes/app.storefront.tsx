import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useSaveBar } from "../components/useSaveBar";
import { merchantActor } from "../lib/admin-actor.server";
import { themeEditorEmbedUrl } from "../lib/setup.server";
import type { StorefrontOptions } from "../lib/storefront";
import { STOREFRONT_DEFAULTS, STOREFRONT_LIMITS, storefrontFromForm } from "../lib/storefront";
import { embedStatus, getStorefront, saveStorefront } from "../lib/storefront.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [options, embed] = await Promise.all([getStorefront(session.shop), embedStatus(admin)]);
  return { options, embed, themeUrl: themeEditorEmbedUrl(session.shop, process.env.SHOPIFY_API_KEY || "") };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  try {
    await saveStorefront(ctx.admin, ctx.session.shop, merchantActor(ctx), storefrontFromForm(await request.formData()));
    return { ok: true as const, error: null };
  } catch (err) {
    console.error("[perks] save storefront failed", err);
    return { ok: false as const, error: "Couldn't save. Try again." };
  }
};

const SAVE_BAR_ID = "storefront-save-bar";
type TextKey = "priceLabel" | "noticeTitle" | "noticeBody" | "noticeButton" | "badgeText";

export default function Storefront() {
  const { options, embed, themeUrl } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const revalidator = useRevalidator();
  useSaveBar(SAVE_BAR_ID);
  const initial = useMemo(() => options, [options]);
  const [o, setO] = useState<StorefrontOptions>(initial);
  useEffect(() => setO(initial), [initial]);
  const set = (p: Partial<StorefrontOptions>) => setO((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(o) !== JSON.stringify(initial);
  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Storefront saved");
    else if (fetcher.data?.error) shopify.toast.show(fetcher.data.error, { isError: true });
  }, [fetcher.data, shopify]);

  const save = () => {
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) body[k] = typeof v === "boolean" ? (v ? "on" : "off") : v;
    fetcher.submit(body, { method: "post" });
  };
  const toggle = (k: "hideProducts" | "showPrice" | "strikePrice") => (e: Event) =>
    set({ [k]: (e.currentTarget as unknown as { checked: boolean }).checked });
  const text = (k: TextKey, label: string, details?: string, area = false) => {
    const props = {
      label,
      details,
      value: o[k],
      maxLength: STOREFRONT_LIMITS[k],
      placeholder: STOREFRONT_DEFAULTS[k],
      onInput: (e: Event) => set({ [k]: (e.currentTarget as unknown as { value: string }).value }),
    };
    return area ? <s-text-area {...props} rows={3} /> : <s-text-field {...props} />;
  };

  return (
    <s-page heading="Storefront">
      <SaveBar id={SAVE_BAR_ID} open={dirty}>
        <button {...{ variant: "primary" }} onClick={save} {...(saving ? { loading: "" } : {})}></button>
        <button onClick={() => setO(initial)}></button>
      </SaveBar>

      <s-stack gap="base">
        <s-section heading="Employee mode">
          <s-stack gap="base">
            {embed.on === true ? (
              <s-banner tone="success" heading="Employee mode is on">
                It&apos;s switched on in {embed.theme ?? "your live theme"}. Employees see their prices, and other shoppers
                don&apos;t see employee-only products.
              </s-banner>
            ) : (
              <s-banner tone="warning" heading={embed.on === false ? "Employee mode is off" : "Turn on Employee mode"}>
                Shopify asks you to switch app features on in your theme yourself. Click the button: Employee mode is
                already switched on there, you just click <strong>Save</strong>.
              </s-banner>
            )}
            <s-stack direction="inline" gap="small">
              <s-button variant={embed.on === true ? "secondary" : "primary"} href={themeUrl} target="_blank">
                {embed.on === true ? "Open theme editor" : "Turn on Employee mode"}
              </s-button>
              <s-button variant="tertiary" onClick={() => revalidator.revalidate()} loading={revalidator.state !== "idle"}>
                Check again
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>

        <s-section heading="Employee price">
          <s-stack gap="base">
            <s-checkbox
              label="Show employees their price on product pages and in collections"
              details="Only logged-in employees see it. Checkout always calculates the exact price."
              checked={o.showPrice}
              onChange={toggle("showPrice")}
            />
            {o.showPrice ? (
              <>
                <s-checkbox label="Cross out the normal price on product pages" checked={o.strikePrice} onChange={toggle("strikePrice")} />
                {text("priceLabel", "Label", "Shown before the price, e.g. “Your employee price Rs 1,700 (15% off)”.")}
              </>
            ) : null}
            {text(
              "badgeText",
              "Message when the price can't be shown",
              "Used if your theme hides its price. {discount} becomes the discount, e.g. 15% off.",
            )}
          </s-stack>
        </s-section>

        <s-section heading="Employee-only products">
          <s-stack gap="base">
            <s-checkbox
              label="Hide employee-only products from other shoppers"
              details="Removes them from collections and search. Checkout always blocks them for non-employees."
              checked={o.hideProducts}
              onChange={toggle("hideProducts")}
            />
            <s-paragraph>Message other shoppers see on an employee-only product page:</s-paragraph>
            {text("noticeTitle", "Title")}
            {text("noticeBody", "Text", undefined, true)}
            {text("noticeButton", "Button", "Opens the page where employees verify their work email.")}
          </s-stack>
        </s-section>

        <s-section slot="aside" heading="Colours">
          <s-paragraph>
            Badge colours follow your theme. To change them, open the theme editor, then App embeds, then Employee mode.
          </s-paragraph>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
