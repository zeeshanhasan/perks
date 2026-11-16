import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useFetcher, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { Metric } from "../components/Metric";
import { RouteError } from "../components/RouteError";
import { PageHelp } from "../components/ui";
import { audit } from "../lib/audit.server";
import { merchantActor } from "../lib/admin-actor.server";
import { formatMoney } from "../lib/business";
import { shopInfo } from "../lib/catalog.server";
import type { Trend } from "../lib/home";
import type { InvoiceLine } from "../lib/invoice.server";
import { businessSummary, createInvoice, listInvoices } from "../lib/invoice.server";
import { lastDay, prettyRange, previousRange, rangeFor, ymd } from "../lib/report";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const preset = url.searchParams.get("range") ?? "this_month";
  const range = rangeFor(preset, new Date(), url.searchParams.get("from"), url.searchParams.get("to"));
  const prev = previousRange(range);
  const [summary, before, invoices, info] = await Promise.all([
    businessSummary(shop, range.from, range.to),
    businessSummary(shop, prev.from, prev.to),
    listInvoices(shop),
    shopInfo(admin, shop),
  ]);

  // Issued invoices don't change. Flag the ones with an order that was cancelled afterwards.
  const billed = invoices.map((i) => {
    let lines: InvoiceLine[] = [];
    try {
      lines = JSON.parse(i.lines);
    } catch {
      lines = [];
    }
    return { invoice: i, names: lines.map((l) => l.orderName) };
  });
  const allNames = [...new Set(billed.flatMap((b) => b.names))];
  const cancelled = allNames.length
    ? new Set(
        (
          await db.orderUsage.findMany({
            where: { shop, cancelled: true, orderName: { in: allNames } },
            select: { orderName: true },
          })
        ).map((o) => o.orderName),
      )
    : new Set<string>();

  return {
    preset,
    from: url.searchParams.get("from") ?? ymd(range.from),
    to: url.searchParams.get("to") ?? lastDay(range),
    period: prettyRange(range.from, range.to),
    previousPeriod: prettyRange(prev.from, prev.to),
    currency: summary.totals.orders ? summary.currency : info.currency,
    summary,
    before: before.totals,
    invoices: billed.map(({ invoice: i, names }) => ({
      id: i.id,
      number: i.number,
      businessId: i.businessId,
      business: i.businessName,
      period: prettyRange(i.periodStart, i.periodEnd),
      basis: i.basis,
      amount: i.amount,
      currency: i.currency,
      cancelledSince: names.filter((n) => cancelled.has(n)).length,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const form = await request.formData();
  const businessId = String(form.get("businessId") ?? "");
  const basis = form.get("basis") === "spend" ? "spend" : "discount";
  const range = rangeFor(String(form.get("range") ?? "this_month"), new Date(), String(form.get("from") ?? ""), String(form.get("to") ?? ""));
  try {
    const inv = await createInvoice(ctx.session.shop, businessId, range.from, range.to, basis, new Date(), ctx.admin);
    await audit({ shop: ctx.session.shop, actor: merchantActor(ctx), action: "invoice.create", subject: inv.number, result: "ok", detail: `${basis} ${inv.amount}` });
    return redirect(`/app/invoices/${inv.id}`);
  } catch (err) {
    console.error("[perks] invoice failed", err);
    return { error: err instanceof Error ? err.message : "Couldn't create invoice" };
  }
};

const PRESETS = [
  ["this_week", "This week"],
  ["last_week", "Last week"],
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["this_year", "This year"],
  ["custom", "Custom range"],
] as const;

const MODAL_ID = "invoice-modal";

/** ↑/↓ against the period before. */
function vs(current: number, previous: number, fmt: (n: number) => string = String): Trend {
  const diff = Math.round((current - previous) * 100) / 100;
  if (diff === 0) return { dir: "flat", text: "Same as the period before" };
  return { dir: diff > 0 ? "up" : "down", text: `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))} vs the period before` };
}

export default function Reports() {
  const { preset, from, to, period, previousPeriod, summary, before, currency, invoices } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const money = (n: number) => formatMoney(n, currency);
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);
  const [basis, setBasis] = useState("discount");
  const [invoiceBusiness, setInvoiceBusiness] = useState("all");
  const val = (e: Event) => (e.currentTarget as unknown as { value: string }).value;
  const loading = navigation.state === "loading";
  const line = summary.lines.find((l) => l.businessId === invoiceFor);

  useEffect(() => {
    if (fetcher.data && "error" in fetcher.data) shopify.toast.show(fetcher.data.error, { isError: true });
  }, [fetcher.data, shopify]);

  const setRange = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };
  const createInvoice = () =>
    invoiceFor &&
    fetcher.submit({ businessId: invoiceFor, basis, range: preset, from: params.get("from") ?? "", to: params.get("to") ?? "" }, { method: "post" });
  const shown = invoiceBusiness === "all" ? invoices : invoices.filter((i) => i.businessId === invoiceBusiness);

  return (
    <s-page heading="Reports">
      <s-stack gap="base">
        <s-section accessibilityLabel="Overview">
          <s-stack gap="base">
            <s-grid gridTemplateColumns="1fr auto minmax(160px, 220px)" gap="base" alignItems="center">
              <s-stack gap="small-300">
                <s-heading>Overview</s-heading>
                <s-text color="subdued">{period}</s-text>
              </s-stack>
              {loading ? <s-spinner size="base" accessibilityLabel="Loading" /> : <s-box />}
              <s-select
                label="Period"
                labelAccessibilityVisibility="exclusive"
                value={preset}
                onChange={(e) => {
                  const v = val(e);
                  setRange(v === "custom" ? { range: v, from, to } : { range: v, from: null, to: null });
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
                <s-date-field label="From" value={from} onChange={(e) => setRange({ from: val(e) })} />
                <s-date-field label="To" value={to} onChange={(e) => setRange({ to: val(e) })} />
              </s-grid>
            ) : null}
            <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 150ms" }}>
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
                <Metric
                  id="orders"
                  label="Employee orders"
                  value={String(summary.totals.orders)}
                  help="Orders placed by employees in this period. Cancelled orders aren't counted."
                  change={vs(summary.totals.orders, before.orders)}
                />
                <Metric
                  id="buyers"
                  label="Employees buying"
                  value={String(summary.totals.employees)}
                  help="Different employees who placed at least one order in this period."
                  change={vs(summary.totals.employees, before.employees)}
                />
                <Metric
                  id="spend"
                  label="Employee spend"
                  value={money(summary.totals.spend)}
                  help="What employees spent on goods in this period, after their discount."
                  change={vs(summary.totals.spend, before.spend, money)}
                />
                <Metric
                  id="discount"
                  label="Discount given"
                  value={money(summary.totals.discount)}
                  help="Employee discount given in this period. This is what you can bill partner companies for."
                  change={vs(summary.totals.discount, before.discount, money)}
                  neutral
                />
              </s-grid>
            </div>
            <s-text color="subdued">Compared with {previousPeriod}.</s-text>
          </s-stack>
        </s-section>

        <s-section heading="By business" padding="none">
          {summary.lines.length ? (
            <s-table>
              <s-table-header-row>
                <s-table-header>Business</s-table-header>
                <s-table-header format="numeric">Orders</s-table-header>
                <s-table-header format="numeric">Employees</s-table-header>
                <s-table-header format="numeric">Spend</s-table-header>
                <s-table-header format="numeric">Discount</s-table-header>
                <s-table-header>
                  <s-text accessibilityVisibility="exclusive">Invoice</s-text>
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {summary.lines.map((l) => (
                  <s-table-row key={l.businessId}>
                    <s-table-cell>{l.name}</s-table-cell>
                    <s-table-cell>{String(l.orders)}</s-table-cell>
                    <s-table-cell>{String(l.employees)}</s-table-cell>
                    <s-table-cell>{money(l.spend)}</s-table-cell>
                    <s-table-cell>{money(l.discount)}</s-table-cell>
                    <s-table-cell>
                      <s-button
                        variant="tertiary"
                        icon="receipt"
                        disabled={!l.orders}
                        commandFor={MODAL_ID}
                        command="--show"
                        onClick={() => {
                          setInvoiceFor(l.businessId);
                          setBasis("discount");
                        }}
                      >
                        Create invoice
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : (
            <s-box padding="base">
              <s-text color="subdued">Add a business to start tracking usage.</s-text>
            </s-box>
          )}
        </s-section>

        <s-section heading="Invoices" padding="none">
          {invoices.length ? (
            <s-table>
              <s-grid slot="filters" gridTemplateColumns="minmax(12rem, 280px)" gap="small">
                <s-select
                  label="Business"
                  labelAccessibilityVisibility="exclusive"
                  value={invoiceBusiness}
                  onChange={(e) => setInvoiceBusiness(val(e))}
                >
                  <s-option value="all">All businesses</s-option>
                  {summary.lines.map((l) => (
                    <s-option key={l.businessId} value={l.businessId}>
                      {l.name}
                    </s-option>
                  ))}
                </s-select>
              </s-grid>
              <s-table-header-row>
                <s-table-header>Invoice</s-table-header>
                <s-table-header>Business</s-table-header>
                <s-table-header>Period</s-table-header>
                <s-table-header>Billed on</s-table-header>
                <s-table-header format="numeric">Amount</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {shown.map((i) => (
                  <s-table-row key={i.id} clickDelegate={`inv-${i.id}`}>
                    <s-table-cell>
                      <s-stack gap="small-300">
                        <s-link id={`inv-${i.id}`} href={`/app/invoices/${i.id}`}>
                          {i.number}
                        </s-link>
                        {i.cancelledSince ? (
                          <s-text color="subdued">
                            {i.cancelledSince} order{i.cancelledSince === 1 ? "" : "s"} cancelled since it was issued
                          </s-text>
                        ) : null}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>{i.business}</s-table-cell>
                    <s-table-cell>{i.period}</s-table-cell>
                    <s-table-cell>{i.basis === "spend" ? "Spend" : "Discount"}</s-table-cell>
                    <s-table-cell>{formatMoney(i.amount, i.currency)}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : (
            <s-box padding="base">
              <s-text color="subdued">No invoices yet. Use &ldquo;Create invoice&rdquo; next to a business above.</s-text>
            </s-box>
          )}
        </s-section>

        <PageHelp title="Usage and billing">
          Every order placed by an employee is recorded against their business. Create an invoice for any period, billed on
          the discount employees received or on their total spend. Issued invoices don&apos;t change, even if an order is
          cancelled later.
        </PageHelp>
      </s-stack>

      <s-modal id={MODAL_ID} heading={line ? `Invoice ${line.name}` : "Create invoice"}>
        {line ? (
          <s-stack gap="base">
            <s-text>Period: {period}</s-text>
            <s-choice-list label="Bill them for" onChange={(e) => setBasis((e.currentTarget as unknown as { values: string[] }).values?.[0] ?? "discount")}>
              <s-choice value="discount" selected={basis === "discount"}>
                The discount their employees received: {money(line.discount)}
              </s-choice>
              <s-choice value="spend" selected={basis === "spend"}>
                Their employees&apos; total spend: {money(line.spend)}
              </s-choice>
            </s-choice-list>
            <s-text color="subdued">
              {line.orders} order{line.orders === 1 ? "" : "s"} from {line.employees} employee{line.employees === 1 ? "" : "s"}. The
              invoice is fixed once created.
            </s-text>
          </s-stack>
        ) : null}
        <s-button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={createInvoice}>
          Create invoice
        </s-button>
        <s-button slot="secondary-actions" commandFor={MODAL_ID} command="--hide">
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Reports" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
