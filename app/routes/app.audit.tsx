import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigation, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { RouteError } from "../components/RouteError";
import { PageHelp } from "../components/ui";
import { shopInfo } from "../lib/catalog.server";
import { maskEmail } from "../lib/domain";
import { authenticate } from "../shopify.server";

const LABELS: Record<string, string> = {
  "settings.update": "Settings changed",
  "storefront.update": "Storefront changed",
  "products.update": "Products changed",
  "invoice.create": "Invoice created",
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

/** "percentage=15 domains=a.com,b.com" → "15% off · a.com, b.com". Falls back to the raw text. */
function readable(detail: string): string {
  const code = DETAILS[detail.split(" ")[0]];
  if (code) return code;
  const kv = Object.fromEntries(
    detail
      .split(" ")
      .map((p) => p.split("="))
      .filter((p) => p.length === 2),
  );
  if (!Object.keys(kv).length) return detail;
  const parts: string[] = [];
  if (kv.percentage) parts.push(`${kv.percentage}% off`);
  if (kv.fixed) parts.push(`${kv.fixed} off each item`);
  if (kv.domains) parts.push(kv.domains.split(",").join(", "));
  if (kv.discount) parts.push(`discount ${kv.discount}`);
  if (kv.spend) parts.push(`spend ${kv.spend}`);
  return parts.length ? parts.join(" · ") : detail;
}

const PAGE = 50;
const SHORT = 60;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const page = Math.max(1, Math.floor(Number(new URL(request.url).searchParams.get("page")) || 1));
  const [events, total, info] = await Promise.all([
    db.auditEvent.findMany({ where: { shop }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE, take: PAGE }),
    db.auditEvent.count({ where: { shop } }),
    shopInfo(admin, shop),
  ]);
  // Customers show as their (partly hidden) work email, never a bare ID.
  const customerIds = [
    ...new Set([
      ...events.filter((e) => e.actor.startsWith("customer:")).map((e) => e.actor.slice(9)),
      // Employee events record the customer they're about as the subject.
      ...events.filter((e) => e.action.startsWith("membership.") && e.subject && /^\d+$/.test(e.subject)).map((e) => e.subject!),
    ]),
  ];
  const members = customerIds.length
    ? await db.employeeMembership.findMany({ where: { shop, customerId: { in: customerIds } }, select: { customerId: true, workEmail: true } })
    : [];
  const emails = new Map(members.map((m) => [m.customerId, maskEmail(m.workEmail)]));
  const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: info.timezone });
  const who = (actor: string) => {
    if (actor === "system") return "Employee Perks (automatic)";
    if (actor.startsWith("merchant:")) return "Staff";
    if (actor.startsWith("customer:")) return emails.get(actor.slice(9)) ?? "A customer";
    return actor;
  };
  return {
    page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
    total,
    events: events.map((e) => {
      // Say who or what it was about: the employee (partly hidden email) or the business / invoice name.
      const about =
        e.subject && /^\d+$/.test(e.subject) ? (emails.get(e.subject) ?? "") : e.subject && !e.action.startsWith("membership.") ? e.subject : "";
      const detail = [...new Set([about, e.detail ? readable(e.detail) : ""].filter(Boolean))].join(" · ");
      return {
        id: e.id,
        at: when.format(e.createdAt),
        who: who(e.actor),
        what: LABELS[e.action] ?? e.action,
        flag: e.result === "rejected" ? "Blocked" : e.result === "error" ? "Failed" : null,
        detail,
        short: detail.length > SHORT ? `${detail.slice(0, SHORT - 1).trimEnd()}…` : detail,
      };
    }),
  };
};

export default function Audit() {
  const { events, page, pages, total } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  const go = (p: number) => {
    const next = new URLSearchParams(params);
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    setParams(next);
  };
  return (
    <s-page heading="Activity">
      <s-stack gap="base">
        <s-section padding="none">
          {events.length ? (
            <>
              <s-table
                paginate={pages > 1}
                hasPreviousPage={page > 1}
                hasNextPage={page < pages}
                loading={navigation.state === "loading"}
                onPreviousPage={() => go(page - 1)}
                onNextPage={() => go(page + 1)}
              >
                <s-table-header-row>
                  <s-table-header>When</s-table-header>
                  <s-table-header>Who</s-table-header>
                  <s-table-header>What</s-table-header>
                  <s-table-header>Details</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {events.map((e) => (
                    <s-table-row key={e.id}>
                      <s-table-cell>{e.at}</s-table-cell>
                      <s-table-cell>{e.who}</s-table-cell>
                      <s-table-cell>
                        <s-stack direction="inline" gap="small-200" alignItems="center">
                          <s-text>{e.what}</s-text>
                          {e.flag ? <s-badge tone={e.flag === "Failed" ? "critical" : "warning"}>{e.flag}</s-badge> : null}
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        {e.short !== e.detail ? (
                          <s-stack direction="inline" gap="small-200" alignItems="center">
                            <s-text color="subdued" interestFor={`d-${e.id}`}>
                              {e.short}
                            </s-text>
                            <s-icon type="info" tone="neutral" size="small" interestFor={`d-${e.id}`} />
                          </s-stack>
                        ) : (
                          <s-text color="subdued">{e.detail || "—"}</s-text>
                        )}
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
              {/* Outside the table so opening one doesn't shift the row. */}
              {events.map((e) =>
                e.short !== e.detail ? (
                  <s-tooltip key={e.id} id={`d-${e.id}`}>
                    {e.detail}
                  </s-tooltip>
                ) : null,
              )}
              <s-box padding="base">
                <s-text color="subdued">
                  {total.toLocaleString("en")} event{total === 1 ? "" : "s"}
                  {pages > 1 ? ` · page ${page} of ${pages}` : ""}
                </s-text>
              </s-box>
            </>
          ) : (
            <s-box padding="base">
              <s-text color="subdued">No activity yet.</s-text>
            </s-box>
          )}
        </s-section>
        <PageHelp title="What's recorded">
          Every settings change, business change and employee change. &ldquo;Blocked&rdquo; means the app stopped
          something on purpose; &ldquo;Failed&rdquo; means something went wrong. Work emails are partly hidden.
        </PageHelp>
      </s-stack>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Activity" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
