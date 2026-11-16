import { useEffect, useRef, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { shopInfo } from "../lib/catalog.server";
import { diagnoseEmail } from "../lib/diagnose.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const { currency } = await shopInfo(admin, session.shop);
  try {
    return await diagnoseEmail(admin, session.shop, String(form.get("email") ?? "").slice(0, 320), currency);
  } catch (err) {
    console.error("[perks] check failed", err);
    return { ok: false as const, error: "Couldn't check this customer. Try again." };
  }
};

const ICON = { ok: "check-circle-filled", fail: "alert-octagon-filled", info: "info" } as const;
const TONE = { ok: "success", fail: "critical", info: "neutral" } as const;

export default function CheckCustomer() {
  const fetcher = useFetcher<typeof action>();
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";
  const r = fetcher.data;
  const run = () => email.trim() && fetcher.submit({ email: email.trim() }, { method: "post" });
  // Polaris fields don't submit the surrounding form on Enter, so listen for it on the field itself.
  const field = useRef<HTMLElement>(null);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") runRef.current();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

  return (
    <s-page heading="Check a customer" inlineSize="base">
      <s-section>
        <s-stack gap="base">
          <s-paragraph>
            Type the email a customer logs in with. You&apos;ll see whether they get employee perks, and if not, exactly
            why and how to fix it.
          </s-paragraph>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <s-stack direction="inline" gap="base" alignItems="end">
              <s-box inlineSize="100%">
                <s-email-field
                  ref={field as never}
                  label="Customer email"
                  value={email}
                  placeholder="sara@acme.com"
                  onInput={(e) => setEmail((e.currentTarget as unknown as { value: string }).value)}
                  error={r && !r.ok ? r.error : undefined}
                />
              </s-box>
              <s-button type="submit" variant="primary" loading={busy}>
                Check
              </s-button>
            </s-stack>
          </form>
        </s-stack>
      </s-section>

      {r && r.ok ? (
        <s-section heading={r.eligible ? `Gets perks from ${r.businessName}` : "Doesn't get perks"}>
          <s-stack gap="base">
            {r.checks.map((c, i) => (
              <s-stack key={i} direction="inline" gap="small" alignItems="start">
                <s-icon type={ICON[c.status]} tone={TONE[c.status]} />
                <s-stack gap="small-300">
                  <s-text type="strong">{c.title}</s-text>
                  {c.detail ? <s-text color="subdued">{c.detail}</s-text> : null}
                  {c.link ? (
                    <s-box>
                      <s-button variant="secondary" onClick={() => navigate(c.link!.href)}>
                        {c.link.label}
                      </s-button>
                    </s-box>
                  ) : null}
                </s-stack>
              </s-stack>
            ))}
            {r.customerId ? (
              <s-box>
                <s-button href={`shopify://admin/customers/${r.customerId}`} target="_top" variant="tertiary">
                  Open customer in Shopify
                </s-button>
              </s-box>
            ) : null}
          </s-stack>
        </s-section>
      ) : null}
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Check a customer" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
