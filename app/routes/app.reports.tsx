import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useNavigation, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { formatMoney } from "../lib/business";
import { shopInfo } from "../lib/catalog.server";
import { businessSummary, ensureInvoices, listMonthlyInvoices, refreshUnknownFulfillment } from "../lib/invoice.server";
import { STATUS_BADGE, downloadInvoiceExcel } from "../lib/invoice-ui";
import { lastDay, prettyRange, rangeFor, ymd } from "../lib/report";
import { authenticate } from "../shopify.server";
import { startTiming } from "../lib/timing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const t = startTiming("reports");
  const { admin, session } = await t.step("auth", () => authenticate.admin(request));
  const shop = session.shop;
  const url = new URL(request.url);
  const preset = url.searchParams.get("range") ?? "this_month";
  const range = rangeFor(preset, new Date(), url.searchParams.get("from"), url.searchParams.get("to"));
  // Orders recorded before fulfilment was tracked: ask Shopify once (no-op afterwards), then number new months.
  await t.step("fulfilment", () => refreshUnknownFulfillment(admin, shop));
  await t.step("numbers", () => ensureInvoices(shop));
  const [summary, invoices, info] = await Promise.all([
    t.step("summary", () => businessSummary(shop, range.from, range.to)),
    t.step("invoices", () => listMonthlyInvoices(shop)),
    shopInfo(admin, shop),
  ]);
  t.done(`shop=${shop}`);
  const months = [...new Map(invoices.map((i) => [i.month, i.monthLabel])).entries()].map(([key, label]) => ({ key, label }));
  const businesses = [...new Map(invoices.map((i) => [i.businessId, i.business])).entries()].map(([id, name]) => ({ id, name }));
  return {
    preset,
    from: url.searchParams.get("from") ?? ymd(range.from),
    to: url.searchParams.get("to") ?? lastDay(range),
    period: prettyRange(range.from, range.to),
    currency: summary.totals.orders ? summary.currency : info.currency,
    summary,
    invoices,
    months,
    businesses,
  };
};

const PRESETS = [
  ["this_week", "This week"],
  ["last_week", "Last week"],
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["this_year", "This year"],
  ["custom", "Custom range"],
] as const;

export default function Reports() {
  const { preset, from, to, period, summary, currency, invoices, months, businesses } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const money = (n: number) => formatMoney(n, currency);
  const val = (e: Event) => (e.currentTarget as unknown as { value: string }).value;
  const loading = navigation.state === "loading";
  // Invoice filters stay in the browser: the list is already loaded.
  const invBusiness = params.get("business") ?? "all";
  const invMonth = params.get("month") ?? "all";

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { preventScrollReset: true });
  };
  const shown = invoices.filter(
    (i) => (invBusiness === "all" || i.businessId === invBusiness) && (invMonth === "all" || i.month === invMonth),
  );
  const shownDue = shown.reduce((s, i) => s + i.due, 0);
  const excel = (id: string, number: string) =>
    downloadInvoiceExcel(id, number).catch(() => shopify.toast.show("Couldn't download the Excel file. Try again.", { isError: true }));

  return (
    <s-page heading="Reports">
      <s-stack gap="base">
        <s-section padding="none" accessibilityLabel="Usage by business">
          <s-box padding="base">
            <s-stack gap="base">
              <s-grid gridTemplateColumns="1fr auto minmax(140px, 200px)" gap="base" alignItems="center">
                <s-stack gap="small-300">
                  <s-heading>Usage by business</s-heading>
                  <s-text color="subdued">What each partner company&apos;s employees bought · {period}</s-text>
                </s-stack>
                {loading ? <s-spinner size="base" accessibilityLabel="Loading" /> : <s-box />}
                <s-select
                  label="Period"
                  labelAccessibilityVisibility="exclusive"
                  value={preset}
                  onChange={(e) => {
                    const v = val(e);
                    setParam(v === "custom" ? { range: v, from, to } : { range: v === "this_month" ? null : v, from: null, to: null });
                  }}
                >
                  {PRESETS.map(([v, l]) => (
                    <s-option key={v} value={v}>
                      {l}
                    </s-option>
                  ))}
                </s-select>
              </s-grid>
              {preset === "custom" ? (
                <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 220px))" gap="base">
                  <s-date-field label="From" value={from} onChange={(e) => setParam({ from: val(e) })} />
                  <s-date-field label="To" value={to} onChange={(e) => setParam({ to: val(e) })} />
                </s-grid>
              ) : null}
            </s-stack>
          </s-box>
          {summary.lines.length ? (
            <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 150ms" }}>
              <s-table>
                <s-table-header-row>
                  <s-table-header>Business</s-table-header>
                  <s-table-header format="numeric">Orders placed</s-table-header>
                  <s-table-header format="numeric">Orders fulfilled</s-table-header>
                  <s-table-header format="numeric">Employees buying</s-table-header>
                  <s-table-header format="numeric">Spend</s-table-header>
                  <s-table-header format="numeric">Discount</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {summary.lines.map((l) => (
                    <s-table-row key={l.businessId}>
                      <s-table-cell>{l.name}</s-table-cell>
                      <s-table-cell>{String(l.orders)}</s-table-cell>
                      <s-table-cell>{String(l.fulfilled)}</s-table-cell>
                      <s-table-cell>{String(l.employees)}</s-table-cell>
                      <s-table-cell>{money(l.spend)}</s-table-cell>
                      <s-table-cell>{money(l.discount)}</s-table-cell>
                    </s-table-row>
                  ))}
                  {summary.lines.length > 1 ? (
                    <s-table-row>
                      <s-table-cell>
                        <s-text type="strong">Total</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text type="strong">{String(summary.totals.orders)}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text type="strong">{String(summary.totals.fulfilled)}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text type="strong">{String(summary.totals.employees)}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text type="strong">{money(summary.totals.spend)}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text type="strong">{money(summary.totals.discount)}</s-text>
                      </s-table-cell>
                    </s-table-row>
                  ) : null}
                </s-table-body>
              </s-table>
            </div>
          ) : (
            <s-box padding="base">
              <s-text color="subdued">Add a business to start tracking usage.</s-text>
            </s-box>
          )}
        </s-section>

        <s-section heading="Monthly invoices" padding="none">
          {invoices.length ? (
            <s-table>
              <s-grid slot="filters" gridTemplateColumns="minmax(150px, 240px) minmax(140px, 200px) 1fr" gap="small" alignItems="center">
                <s-select label="Business" labelAccessibilityVisibility="exclusive" value={invBusiness} onChange={(e) => setParam({ business: val(e) })}>
                  <s-option value="all">All businesses</s-option>
                  {businesses.map((b) => (
                    <s-option key={b.id} value={b.id}>
                      {b.name}
                    </s-option>
                  ))}
                </s-select>
                <s-select label="Month" labelAccessibilityVisibility="exclusive" value={invMonth} onChange={(e) => setParam({ month: val(e) })}>
                  <s-option value="all">All months</s-option>
                  {months.map((m) => (
                    <s-option key={m.key} value={m.key}>
                      {m.label}
                    </s-option>
                  ))}
                </s-select>
                <s-text color="subdued">
                  {shown.length} invoice{shown.length === 1 ? "" : "s"} · {money(shownDue)} due
                </s-text>
              </s-grid>
              <s-table-header-row>
                <s-table-header listSlot="primary">Invoice</s-table-header>
                <s-table-header listSlot="secondary">Business</s-table-header>
                <s-table-header>Month</s-table-header>
                <s-table-header listSlot="inline">Status</s-table-header>
                <s-table-header format="numeric">Orders fulfilled</s-table-header>
                <s-table-header format="numeric">In process</s-table-header>
                <s-table-header format="numeric">Amount due</s-table-header>
                <s-table-header>
                  <s-text accessibilityVisibility="exclusive">Actions</s-text>
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {shown.map((i) => {
                  const badge = STATUS_BADGE[i.status];
                  return (
                    <s-table-row key={i.id}>
                      <s-table-cell>
                        <s-text type="strong">{i.number}</s-text>
                      </s-table-cell>
                      <s-table-cell>{i.business}</s-table-cell>
                      <s-table-cell>{i.monthLabel}</s-table-cell>
                      <s-table-cell>
                        <s-badge tone={badge.tone}>{badge.label}</s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        {i.fulfilled} of {i.orders}
                      </s-table-cell>
                      <s-table-cell>{i.inProcess ? formatMoney(i.inProcess, i.currency) : "—"}</s-table-cell>
                      <s-table-cell>{formatMoney(i.due, i.currency)}</s-table-cell>
                      <s-table-cell>
                        <s-stack direction="inline" gap="small-200" justifyContent="end">
                          <s-button variant="tertiary" icon="view" onClick={() => navigate(`/app/invoices/${i.id}`)}>
                            View
                          </s-button>
                          <s-button variant="tertiary" icon="export" onClick={() => excel(i.id, i.number)}>
                            Excel
                          </s-button>
                          <s-button variant="tertiary" icon="print" onClick={() => navigate(`/app/invoices/${i.id}?print=1`)}>
                            PDF
                          </s-button>
                        </s-stack>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          ) : (
            <s-box padding="base">
              <s-text color="subdued">
                No invoices yet. Each partner business gets one invoice a month, as soon as its employees place an order.
              </s-text>
            </s-box>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Reports" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
