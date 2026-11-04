import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { PageHelp } from "../components/ui";
import { authenticate } from "../shopify.server";

const LABELS: Record<string, string> = {
  "settings.update": "Settings changed",
  "products.update": "Products changed",
  "verify.request": "Verification email requested",
  "verify.confirm": "Work email verified",
  "membership.revoke": "Perks removed",
  "membership.reactivate": "Perks restored",
  "membership.expire": "Verification expired",
  "membership.domain_join": "Joined by work-email login",
  "membership.domain_active": "Work email matches again",
  "membership.domain_inactive": "Work email no longer matches",
  "privacy.customer_data_request": "Customer data requested",
  "privacy.customer_redact": "Customer data deleted",
  "business.create": "Business added",
  "shopify.sync": "Updating Shopify failed",
  "business.update": "Business updated",
  "business.delete": "Business deleted",
  "business.pause": "Business paused",
  "business.resume": "Business resumed",
};

const DETAILS: Record<string, string> = {
  rate_limited: "Too many attempts",
  domain_not_allowed: "Email domain not approved",
  email_in_use: "Work email already used by another account",
  send_failed: "Email couldn't be sent",
  wrong_customer: "Link opened by a different account",
  used: "Link already used",
  expired: "Link expired",
  not_found: "Invalid link",
  publish_failed: "Couldn't update Shopify",
};

function who(actor: string) {
  if (actor === "system") return "Employee Perks";
  if (actor.startsWith("merchant:")) return "Staff";
  if (actor.startsWith("customer:")) return `Customer ${actor.slice(9)}`;
  return actor;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const events = await db.auditEvent.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return {
    events: events.map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      who: who(e.actor),
      what: LABELS[e.action] ?? e.action,
      result: e.result,
      detail: e.detail ? (DETAILS[e.detail.split(" ")[0]] ?? e.detail) : "",
    })),
  };
};

const RESULT: Record<string, { label: string; tone: "success" | "critical" | "warning" }> = {
  ok: { label: "Done", tone: "success" },
  rejected: { label: "Blocked", tone: "warning" },
  error: { label: "Failed", tone: "critical" },
};

export default function Audit() {
  const { events } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Activity">
      <s-stack gap="base">
        <PageHelp title="What's recorded">
          Every settings change, verification attempt and employee change, for the last 200 events. Work emails are
          partly hidden and links are never stored.
        </PageHelp>
        <s-section padding="none">
          {events.length ? (
            <s-table>
              <s-table-header-row>
                <s-table-header>When</s-table-header>
                <s-table-header>Who</s-table-header>
                <s-table-header>What</s-table-header>
                <s-table-header>Result</s-table-header>
                <s-table-header>Details</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {events.map((e) => (
                  <s-table-row key={e.id}>
                    <s-table-cell>{new Date(e.at).toLocaleString()}</s-table-cell>
                    <s-table-cell>{e.who}</s-table-cell>
                    <s-table-cell>{e.what}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={RESULT[e.result]?.tone ?? "neutral"}>{RESULT[e.result]?.label ?? e.result}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">{e.detail}</s-text>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : (
            <s-box padding="base">
              <s-text color="subdued">No activity yet.</s-text>
            </s-box>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
