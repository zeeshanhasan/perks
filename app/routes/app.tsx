import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
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
      ? { planUrl: billing.planUrl, shopifyPlan: billing.shopifyPlan ?? "" }
      : null;

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", wrongPlan };
};

/** A store on Grow or above that picked the $9 plan: explain, and send it to choose Standard. */
function WrongPlan({ planUrl, shopifyPlan }: { planUrl: string; shopifyPlan: string }) {
  return (
    <s-page heading="Choose the Standard plan">
      <s-section>
        <s-stack gap="base">
          <s-paragraph>
            The Basic plan (${PRICES.basic.monthly}/month) is for stores on Shopify&apos;s Basic plan. Your store is on{" "}
            {shopifyPlan || "a larger Shopify plan"}, so the Standard plan (${PRICES.standard.monthly}/month) applies. Every
            feature is the same.
          </s-paragraph>
          <s-paragraph>Your perks keep working while you switch.</s-paragraph>
          <s-button variant="primary" onClick={() => window.open(planUrl, "_top")}>
            Choose Standard
          </s-button>
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
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
