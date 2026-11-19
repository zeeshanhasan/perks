import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { isRouteErrorResponse, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import db from "../db.server";
import { AppStatus } from "../components/AppStatus";
import { checkBilling } from "../lib/billing.server";
import { PRICES } from "../lib/billing";
import { startTiming } from "../lib/timing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const t = startTiming("app-root");
  const { admin, session, redirect } = await t.step("auth", () => authenticate.admin(request));

  // Billing (decision 017): stores without a plan go to Shopify's plan page. Off until the Partner API is set up.
  const fresh = new URL(request.url).searchParams.has("plan_handle");
  const billing = await t.step("billing", () => checkBilling(admin, session.shop, undefined, undefined, { fresh, timing: t }));
  t.done(`shop=${session.shop} path=${new URL(request.url).pathname}`);
  if (billing.billing && billing.state.kind === "needs_plan") {
    throw redirect(billing.planUrl, { target: "_top" });
  }
  const wrongPlan =
    billing.billing && billing.state.kind === "wrong_plan"
      ? {
          planUrl: billing.planUrl,
          shopifyPlan: billing.shopifyPlan ?? "",
          // Only stores with perks running are told they keep working; a new store has none yet.
          perksLive: await hasLivePerks(session.shop),
        }
      : null;

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", wrongPlan };
};

async function hasLivePerks(shop: string) {
  const [policy, businesses] = await Promise.all([
    db.benefitPolicy.findUnique({ where: { shop }, select: { enabled: true } }),
    db.business.count({ where: { shop, active: true, archivedAt: null } }),
  ]);
  return Boolean(policy?.enabled && businesses > 0);
}

/** A store on Grow or above that picked the $9 plan: explain, and send it to choose Standard. */
function WrongPlan({ planUrl, shopifyPlan, perksLive }: { planUrl: string; shopifyPlan: string; perksLive: boolean }) {
  return (
    <s-page heading="One more step: switch to Standard">
      <s-section>
        <s-stack gap="base">
          <s-paragraph>
            Basic is for stores on Shopify&apos;s Basic or Starter plan. Your store is on{" "}
            {shopifyPlan || "a larger Shopify plan"}, so Standard applies. It has exactly the same features.
          </s-paragraph>
          <s-paragraph>
            Your free trial carries over, and Standard replaces Basic: you&apos;re never charged for both.
            {perksLive ? " Your perks keep working while you switch." : ""}
          </s-paragraph>
          <s-box padding="base" border="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text type="strong">Standard</s-text>
              <s-text>
                ${PRICES.standard.monthly}/month or ${PRICES.standard.yearly}/year · 30-day free trial
              </s-text>
              <s-unordered-list>
                <s-list-item>Unlimited partner companies and employees</s-list-item>
                <s-list-item>Automatic discount by work email, no codes</s-list-item>
                <s-list-item>Employee prices in your theme and employee-only products</s-list-item>
                <s-list-item>Monthly or yearly limits, reports and invoices</s-list-item>
              </s-unordered-list>
            </s-stack>
          </s-box>
          <s-box>
            <s-button variant="primary" onClick={() => window.open(planUrl, "_top")}>
              Switch to Standard
            </s-button>
          </s-box>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export default function App() {
  const { apiKey, wrongPlan } = useLoaderData<typeof loader>();

  if (wrongPlan)
    return (
      <AppProvider apiKey={apiKey}>
        <WrongPlan {...wrongPlan} />
      </AppProvider>
    );

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app" {...{ rel: "home" }}>Home</s-link>
        <s-link href="/app/businesses">Businesses</s-link>
        <s-link href="/app/employees">Employees</s-link>
        <s-link href="/app/reports">Reports</s-link>
        <s-link href="/app/storefront">Storefront</s-link>
        <s-link href="/app/perks-page">Perks page</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <AppStatus />
      {/* Lets layouts react to the page width (phone vs desktop) with @container rules. */}
      <s-query-container>
        <Outlet />
      </s-query-container>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  // Auth and redirects must go to Shopify's boundary; anything else (offline, a timeout) gets a friendly page.
  if (isRouteErrorResponse(error) || error instanceof Response) return boundary.error(error);
  return (
    <div style={{ font: "14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "48px 16px", textAlign: "center", color: "#303030" }}>
      <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 6px" }}>Employee Perks couldn&apos;t load</p>
      <p style={{ color: "#616161", margin: "0 0 16px" }}>
        {typeof navigator !== "undefined" && !navigator.onLine
          ? "You seem to be offline. Check your connection, then try again."
          : "It's usually a short hiccup with your connection or Shopify. Your settings are safe."}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{ font: "inherit", fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: 0, background: "#303030", color: "#fff", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
