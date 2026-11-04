import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { formatMoney } from "../lib/business";
import { shopCurrency } from "../lib/catalog.server";
import { getInvoice, invoiceCsv } from "../lib/invoice.server";
import { lastDay, ymd } from "../lib/report";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const data = await getInvoice(session.shop, params.id!);
  if (!data) throw redirect("/app/reports");
  const { name } = await shopCurrency(admin);
  const { invoice, business, lines } = data;
  return {
    shopName: name || session.shop,
    csv: invoiceCsv(data),
    invoice: {
      number: invoice.number,
      created: ymd(invoice.createdAt),
      period: `${ymd(invoice.periodStart)} to ${lastDay({ to: invoice.periodEnd })}`,
      basis: invoice.basis,
      amount: invoice.amount,
      currency: invoice.currency,
      orderCount: invoice.orderCount,
    },
    business: {
      name: business?.name ?? invoice.businessName,
      billingEmail: business?.billingEmail ?? "",
      billingAddress: business?.billingAddress ?? "",
    },
    lines,
  };
};

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #perks-invoice, #perks-invoice * { visibility: visible !important; }
  #perks-invoice { position: absolute; inset: 0; padding: 24px; }
  .perks-noprint { display: none !important; }
}
#perks-invoice table { width: 100%; border-collapse: collapse; font-size: 13px; }
#perks-invoice th, #perks-invoice td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e3e3e3; }
#perks-invoice td.num, #perks-invoice th.num { text-align: right; }
#perks-invoice tfoot td { font-weight: 600; border-bottom: none; }
`;

export default function InvoicePage() {
  const { invoice, business, lines, shopName, csv } = useLoaderData<typeof loader>();
  const money = (n: number) => formatMoney(n, invoice.currency);
  const billed = (l: { spend: number; discount: number }) => (invoice.basis === "spend" ? l.spend : l.discount);

  const download = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${invoice.number}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <s-page heading={`Invoice ${invoice.number}`}>
      <style>{PRINT_CSS}</style>
      <s-link slot="breadcrumb-actions" href="/app/reports">
        Reports
      </s-link>
      <s-button slot="primary-action" variant="primary" icon="print" onClick={() => window.print()}>
        Print / Save PDF
      </s-button>
      <s-button slot="secondary-actions" icon="export" onClick={download}>
        Download CSV
      </s-button>

      <s-section>
        <div id="perks-invoice">
          <s-stack gap="large">
            <s-stack direction="inline" justifyContent="space-between" gap="base">
              <s-stack gap="small-200">
                <s-heading>{shopName}</s-heading>
                <s-text color="subdued">Employee perks invoice</s-text>
              </s-stack>
              <s-stack gap="small-200">
                <s-text type="strong">{invoice.number}</s-text>
                <s-text>Issued {invoice.created}</s-text>
                <s-text>Period {invoice.period}</s-text>
              </s-stack>
            </s-stack>

            <s-stack gap="small-200">
              <s-text color="subdued">Bill to</s-text>
              <s-text type="strong">{business.name}</s-text>
              {business.billingAddress ? <s-text>{business.billingAddress}</s-text> : null}
              {business.billingEmail ? <s-text>{business.billingEmail}</s-text> : null}
            </s-stack>

            <s-text>
              Billed on: <strong>{invoice.basis === "spend" ? "employee spend" : "employee discount received"}</strong> ·{" "}
              {invoice.orderCount} order{invoice.orderCount === 1 ? "" : "s"}
            </s-text>

            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer ID</th>
                  <th className="num">Spend</th>
                  <th className="num">Discount</th>
                  <th className="num">Billed</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.orderName}>
                    <td>{l.orderName}</td>
                    <td>{l.date}</td>
                    <td>{l.customerId}</td>
                    <td className="num">{money(l.spend)}</td>
                    <td className="num">{money(l.discount)}</td>
                    <td className="num">{money(billed(l))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Total due</td>
                  <td className="num">{money(invoice.amount)}</td>
                </tr>
              </tfoot>
            </table>
          </s-stack>
        </div>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
