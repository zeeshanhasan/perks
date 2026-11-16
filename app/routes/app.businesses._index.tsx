import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { RouteError } from "../components/RouteError";
import { PageHelp } from "../components/ui";
import { describeDiscount, describeLimit } from "../lib/business";
import { listBusinesses } from "../lib/business.server";
import { merchantActor } from "../lib/admin-actor.server";
import { shopInfo } from "../lib/catalog.server";
import { setBusinessActive } from "../lib/settings.server";
import type { Targeting } from "../lib/targeting";
import { describeTarget, isEmptyTarget } from "../lib/targeting";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [list, counts, { currency }] = await Promise.all([
    listBusinesses(session.shop),
    db.employeeMembership.groupBy({ by: ["businessId"], where: { shop: session.shop, status: "active" }, _count: true }),
    shopInfo(admin, session.shop), // cached for 10 minutes
  ]);
  // Active businesses first, then by name.
  const businesses = [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const active = new Map(counts.map((c) => [c.businessId, c._count]));
  // Short words in the table; the details go in a tooltip so the table doesn't scroll sideways.
  const products = (t: Targeting, empty: string) =>
    t.all ? { short: "All products", full: null } : isEmptyTarget(t) ? { short: empty, full: null } : { short: "Some products", full: describeTarget(t) };
  return {
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      domains: b.domains,
      discount: describeDiscount(b, currency),
      applies: products(b.discountTarget, "Employee-only only"),
      employeeOnly: products(b.employeeOnlyTarget, "None"),
      limit: {
        short: b.limitPeriod === "none" || !b.limitAmount ? "No limit" : b.limitPeriod === "year" ? "Yearly" : "Monthly",
        full: b.limitPeriod === "none" || !b.limitAmount ? null : describeLimit(b, currency),
      },
      employees: active.get(b.id) ?? 0,
      active: b.active,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const active = form.get("active") === "on";
  try {
    const b = await setBusinessActive(ctx.admin, ctx.session.shop, merchantActor(ctx), id, active);
    return { ok: true as const, message: b ? `${b.name} ${active ? "is active" : "paused"}` : "Business not found" };
  } catch (err) {
    console.error("[perks] toggle business failed", err);
    return { ok: false as const, message: "Couldn't update the business. Try again." };
  }
};

function ActiveSwitch({ id, name, active }: { id: string; name: string; active: boolean }) {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const pending = fetcher.formData ? fetcher.formData.get("active") === "on" : active;
  useEffect(() => {
    if (fetcher.data) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);
  return (
    <s-switch
      label={pending ? "Active" : "Paused"}
      accessibilityLabel={`${name}: ${pending ? "active" : "paused"}`}
      checked={pending}
      disabled={fetcher.state !== "idle"}
      onChange={(e) =>
        fetcher.submit(
          { id, active: (e.currentTarget as unknown as { checked: boolean }).checked ? "on" : "off" },
          { method: "post" },
        )
      }
    />
  );
}

// Tooltips live outside the table (rendered after it): inside a cell they nudged the row when they opened.

/** Short text; when there's more to say, hovering it (or the info icon) shows the rest. */
function WithTip({ id, text, tip }: { id: string; text: string; tip: string | null }) {
  if (!tip) return <s-text>{text}</s-text>;
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-text interestFor={id}>{text}</s-text>
      <s-icon type="info" tone="neutral" size="small" interestFor={id} />
    </s-stack>
  );
}

/** First domain, then a bold "+N"; hovering it shows the others. (A chip made the table too wide, so it fell back to its stacked layout.) */
function Domains({ id, domains }: { id: string; domains: string[] }) {
  if (!domains.length) return null;
  const [first, ...rest] = domains;
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-text color="subdued">{first}</s-text>
      {rest.length ? (
        <s-text type="strong" interestFor={id}>
          +{rest.length}
        </s-text>
      ) : null}
    </s-stack>
  );
}

export default function Businesses() {
  const { businesses } = useLoaderData<typeof loader>();
  const tips = businesses.flatMap((b) => [
    { id: `domains-${b.id}`, text: b.domains.slice(1).join(", ") },
    { id: `applies-${b.id}`, text: b.applies.full },
    { id: `only-${b.id}`, text: b.employeeOnly.full },
    { id: `limit-${b.id}`, text: b.limit.full },
  ]);
  return (
    <s-page heading="Businesses">
      <s-button slot="primary-action" variant="primary" href="/app/businesses/new">
        Add business
      </s-button>
      <s-stack gap="base">
        {businesses.length ? (
          <s-section padding="none">
            <s-table>
              <s-table-header-row>
                <s-table-header>Business</s-table-header>
                <s-table-header>Discount</s-table-header>
                <s-table-header>Applies to</s-table-header>
                <s-table-header>Employee-only</s-table-header>
                <s-table-header>Limit</s-table-header>
                <s-table-header>Employees</s-table-header>
                <s-table-header>Perks</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {businesses.map((b) => (
                  <s-table-row key={b.id} clickDelegate={`open-${b.id}`}>
                    <s-table-cell>
                      <s-stack gap="small-300">
                        <s-link id={`open-${b.id}`} href={`/app/businesses/${b.id}`}>
                          {b.name}
                        </s-link>
                        <Domains id={`domains-${b.id}`} domains={b.domains} />
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>{b.discount}</s-table-cell>
                    <s-table-cell>
                      <WithTip id={`applies-${b.id}`} text={b.applies.short} tip={b.applies.full} />
                    </s-table-cell>
                    <s-table-cell>
                      <WithTip id={`only-${b.id}`} text={b.employeeOnly.short} tip={b.employeeOnly.full} />
                    </s-table-cell>
                    <s-table-cell>
                      <WithTip id={`limit-${b.id}`} text={b.limit.short} tip={b.limit.full} />
                    </s-table-cell>
                    <s-table-cell>{String(b.employees)}</s-table-cell>
                    <s-table-cell>
                      <ActiveSwitch id={b.id} name={b.name} active={b.active} />
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            {tips.map((t) =>
              t.text ? (
                <s-tooltip key={t.id} id={t.id}>
                  {t.text}
                </s-tooltip>
              ) : null,
            )}
          </s-section>
        ) : (
          <s-section>
            <s-empty-state heading="Add your first partner business">
              <s-paragraph>
                Add a company, its email domains and the discount its employees get. You can add as many businesses as
                you like, each with different discounts and products.
              </s-paragraph>
              <s-button slot="primary-action" variant="primary" href="/app/businesses/new">
                Add business
              </s-button>
            </s-empty-state>
          </s-section>
        )}
        <PageHelp title="Partner businesses">
          Each business has its own email domains, discount, products and limits. Employees are matched to a
          business by their work email domain.
        </PageHelp>
      </s-stack>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Businesses" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
