import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { useSaveBar } from "../components/useSaveBar";
import { merchantActor } from "../lib/admin-actor.server";
import { formatMoney } from "../lib/business";
import { shopInfo } from "../lib/catalog.server";
import { themeEditorEmbedUrl } from "../lib/setup.server";
import type { StorefrontOptions } from "../lib/storefront";
import { STOREFRONT_DEFAULTS, STOREFRONT_LIMITS, storefrontFromForm } from "../lib/storefront";
import { embedStatus, getStorefront, saveStorefront } from "../lib/storefront.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [options, embed, info] = await Promise.all([getStorefront(session.shop), embedStatus(admin), shopInfo(admin, session.shop)]);
  return {
    options,
    embed,
    currency: info.currency,
    themeUrl: themeEditorEmbedUrl(session.shop, process.env.SHOPIFY_API_KEY || ""),
  };
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

// Previews of what shoppers see. Plain boxes, not Polaris: they stand in for the merchant's theme.
const preview = {
  card: { border: "1px solid #e3e3e3", borderRadius: 12, padding: 12, background: "#fff", fontSize: 13, color: "#303030" },
  image: { background: "#f1f1f1", borderRadius: 8, height: 72, marginBottom: 8 },
  title: { fontWeight: 600, marginBottom: 4 },
  muted: { color: "#8a8a8a" },
  button: { display: "inline-block", marginTop: 8, padding: "6px 12px", borderRadius: 8, background: "#303030", color: "#fff", fontWeight: 600 },
} as const;

function PreviewLabel({ children }: { children: string }) {
  return (
    <s-text color="subdued">
      {children}
    </s-text>
  );
}

export default function Storefront() {
  const { options, embed, themeUrl, currency } = useLoaderData<typeof loader>();
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
  const [wordingEmployees, setWordingEmployees] = useState(false);
  const [wordingOthers, setWordingOthers] = useState(false);

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
  const word = (k: TextKey) => o[k] || STOREFRONT_DEFAULTS[k];
  const full = formatMoney(2000, currency);
  const employee = formatMoney(1700, currency);

  return (
    <s-page heading="Storefront">
      <SaveBar id={SAVE_BAR_ID} open={dirty}>
        <button {...{ variant: "primary" }} onClick={save} {...(saving ? { loading: "" } : {})}></button>
        <button onClick={() => setO(initial)}></button>
      </SaveBar>

      <s-stack gap="base">
        <s-section>
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-stack gap="small-300">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text type="strong">Employee mode</s-text>
                <s-badge tone={embed.on === true ? "success" : embed.on === false ? "warning" : "neutral"}>
                  {embed.on === true ? "On" : embed.on === false ? "Off" : "Unknown"}
                </s-badge>
              </s-stack>
              <s-text color="subdued">
                {embed.on === true
                  ? `Switched on in ${embed.theme ?? "your live theme"}. Badge colours follow your theme (theme editor → App embeds → Employee mode).`
                  : "Needed for everything below. Click Turn on: it's already switched on in the theme editor, you just click Save there."}
              </s-text>
            </s-stack>
            <s-stack direction="inline" gap="small">
              <s-button variant="tertiary" onClick={() => revalidator.revalidate()} loading={revalidator.state !== "idle"}>
                Check again
              </s-button>
              <s-button variant={embed.on === true ? "secondary" : "primary"} href={themeUrl} target="_blank">
                {embed.on === true ? "Open theme editor" : "Turn on"}
              </s-button>
            </s-stack>
          </s-grid>
        </s-section>

        <s-section heading="What employees see">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
            <s-stack gap="base">
              <s-checkbox
                label="Show employees their price on product pages and in collections"
                details="Only logged-in employees see it. Checkout always works out the exact price."
                checked={o.showPrice}
                onChange={toggle("showPrice")}
              />
              {o.showPrice ? (
                <s-checkbox label="Cross out the normal price" checked={o.strikePrice} onChange={toggle("strikePrice")} />
              ) : null}
              <s-box>
                <s-button variant="tertiary" icon={wordingEmployees ? "chevron-up" : "chevron-down"} onClick={() => setWordingEmployees(!wordingEmployees)}>
                  Edit wording
                </s-button>
              </s-box>
              {wordingEmployees ? (
                <s-stack gap="base">
                  {text("priceLabel", "Text before the employee price")}
                  {text(
                    "badgeText",
                    "Backup message (if your theme hides prices)",
                    "Shown instead of the price on themes that hide it. Write {discount} where the discount should go, e.g. 15% off.",
                  )}
                </s-stack>
              ) : null}
            </s-stack>
            <s-stack gap="small-200">
              <PreviewLabel>Preview: a product card, for an employee</PreviewLabel>
              <div style={preview.card}>
                <div style={preview.image} />
                <div style={preview.title}>Sample product</div>
                {o.showPrice ? (
                  <div>
                    {word("priceLabel")} <strong>{employee}</strong>{" "}
                    {o.strikePrice ? <s style={preview.muted}>{full}</s> : null}
                  </div>
                ) : (
                  <div>
                    {full}
                    <div style={preview.muted}>{word("badgeText").replace("{discount}", "15% off")}</div>
                  </div>
                )}
              </div>
            </s-stack>
          </s-grid>
        </s-section>

        <s-section heading="What other shoppers see">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
            <s-stack gap="base">
              <s-checkbox
                label="Hide employee-only products from other shoppers"
                details="Removes them from collections and search. Checkout always blocks them for anyone who isn't an employee."
                checked={o.hideProducts}
                onChange={toggle("hideProducts")}
              />
              <s-text color="subdued">
                Someone with a direct link to an employee-only product sees the message on the right instead of the buy button.
              </s-text>
              <s-box>
                <s-button variant="tertiary" icon={wordingOthers ? "chevron-up" : "chevron-down"} onClick={() => setWordingOthers(!wordingOthers)}>
                  Edit wording
                </s-button>
              </s-box>
              {wordingOthers ? (
                <s-stack gap="base">
                  {text("noticeTitle", "Title")}
                  {text("noticeBody", "Text", undefined, true)}
                  {text("noticeButton", "Button", "Opens the page where employees verify their work email.")}
                </s-stack>
              ) : null}
            </s-stack>
            <s-stack gap="small-200">
              <PreviewLabel>Preview: an employee-only product page, for anyone else</PreviewLabel>
              <div style={preview.card}>
                <div style={preview.title}>{word("noticeTitle")}</div>
                <div style={preview.muted}>{word("noticeBody")}</div>
                <span style={preview.button}>{word("noticeButton")}</span>
              </div>
            </s-stack>
          </s-grid>
        </s-section>

        <s-text color="subdued">
          Looking for the public list of partner companies? It&apos;s on the <s-link href="/app/perks-page">Perks page</s-link>.
        </s-text>
      </s-stack>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Storefront" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
