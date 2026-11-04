import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PageHelp, Stat } from "../components/ui";
import { audit } from "../lib/audit.server";
import { merchantActor } from "../lib/admin-actor.server";
import { formatMoney } from "../lib/business";
import { shopCurrency } from "../lib/catalog.server";
import { businessSummary, createInvoice, listInvoices } from "../lib/invoice.server";
import { lastDay, rangeFor, ymd } from "../lib/report";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const preset = url.searchParams.get("range") ?? "this_month";
  const range = rangeFor(preset, new Date(), url.searchParams.get("from"), url.searchParams.get("to"));
  const [summary, invoices, shopInfo] = await Promise.all([
    businessSummary(session.shop, range.from, range.to),
    listInvoices(session.shop),
    shopCurrency(admin),
  ]);
  return {
    preset,
    range: { from: ymd(range.from), to: lastDay(range), label: range.label },
    currency: summary.lines.length && summary.totals.orders ? summary.currency : shopInfo.currency,
    summary,
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      business: i.businessName,
      period: `${ymd(i.periodStart)} – ${lastDay({ to: i.periodEnd })}`,
      basis: i.basis,
      amount: i.amount,
      currency: i.currency,
      orders: i.orderCount,
      created: ymd(i.createdAt),
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
    const inv = await createInvoice(ctx.session.shop, businessId, range.from, range.to, basis);
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

export default function Reports() {
  const { preset, range, summary, currency, invoices } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const [p, setP] = useState(preset);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const money = (n: number) => formatMoney(n, currency);
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);
  const [basis, setBasis] = useState("discount");

  useEffect(() => {
    if (fetcher.data && "error" in fetcher.data) shopify.toast.show(fetcher.data.error, { isError: true });
  }, [fetcher.data, shopify]);

  const createInvoice = (businessId: string) =>
    fetcher.submit(
      { businessId, basis, range: preset, from: params.get("from") ?? "", to: params.get("to") ?? "" },
      { method: "post" },
    );

  return (
    <s-page heading="Reports">
      <s-stack gap="base">
        <PageHelp title="Usage and billing">
          Every order placed by an employee is recorded against their business. Generate an invoice for any period,
          billed on the discount employees received or on their total spend.
        </PageHelp>

        <s-section>
          <Form method="get">
            <s-stack direction="inline" gap="base" alignItems="end">
              <s-select label="Period" name="range" value={p} onChange={(e) => setP((e.currentTarget as unknown as { value: string }).value)}>
                {PRESETS.map(([v, l]) => (
                  <s-option key={v} value={v}>
                    {l}
                  </s-option>
                ))}
              </s-select>
              {p === "custom" ? (
                <>
                  <s-date-field label="From" name="from" defaultValue={params.get("from") ?? range.from} />
                  <s-date-field label="To" name="to" defaultValue={params.get("to") ?? range.to} />
                </>
              ) : null}
              <s-button type="submit">Apply</s-button>
            </s-stack>
          </Form>
          <s-box paddingBlockStart="small">
            <s-text color="subdued">
              {range.label}: {range.from} to {range.to}
            </s-text>
          </s-box>
        </s-section>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <Stat label="Employee orders" value={summary.totals.orders} />
          <Stat label="Employees buying" value={summary.totals.employees} />
          <Stat label="Employee spend" value={money(summary.totals.spend)} />
          <Stat label="Discount given" value={money(summary.totals.discount)} />
        </s-grid>

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
                      {invoiceFor === l.businessId ? (
                        <s-stack direction="inline" gap="small" alignItems="center">
                          <s-select label="Bill on" labelAccessibilityVisibility="exclusive" value={basis} onChange={(e) => setBasis((e.currentTarget as unknown as { value: string }).value)}>
                            <s-option value="discount">Bill discount ({money(l.discount)})</s-option>
                            <s-option value="spend">Bill spend ({money(l.spend)})</s-option>
                          </s-select>
                          <s-button
                            variant="primary"
                            onClick={() => createInvoice(l.businessId)}
                            {...(fetcher.state !== "idle" ? { loading: true } : {})}
                          >
                            Create
                          </s-button>
                          <s-button variant="tertiary" onClick={() => setInvoiceFor(null)}>
                            Cancel
                          </s-button>
                        </s-stack>
                      ) : (
                        <s-button variant="tertiary" icon="receipt" disabled={!l.orders} onClick={() => setInvoiceFor(l.businessId)}>
                          Invoice
                        </s-button>
                      )}
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
              <s-table-header-row>
                <s-table-header>Invoice</s-table-header>
                <s-table-header>Business</s-table-header>
                <s-table-header>Period</s-table-header>
                <s-table-header>Billed on</s-table-header>
                <s-table-header format="numeric">Amount</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {invoices.map((i) => (
                  <s-table-row key={i.id}>
                    <s-table-cell>
                      <s-link href={`/app/invoices/${i.id}`}>{i.number}</s-link>
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
              <s-text color="subdued">No invoices yet. Use &ldquo;Invoice&rdquo; next to a business above.</s-text>
            </s-box>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
