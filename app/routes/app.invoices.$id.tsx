import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { gql } from "../lib/admin-graphql.server";
import { formatMoney } from "../lib/business";
import { employeeRows, getInvoice, invoiceCsv } from "../lib/invoice.server";
import { prettyRange } from "../lib/report";
import { authenticate } from "../shopify.server";

type ShopDetails = { name: string; email: string; address: string[] };

/** The store's name, email and address for the "From" block. Falls back to the shop domain. */
async function shopDetails(admin: Parameters<typeof gql>[0], shop: string): Promise<ShopDetails> {
  try {
    const data = await gql<{
      shop: {
        name: string;
        email: string;
        shopAddress: { address1: string | null; address2: string | null; city: string | null; province: string | null; zip: string | null; country: string | null } | null;
      };
    }>(admin, `#graphql
      query PerksInvoiceShop {
        shop {
          name
          email
          shopAddress { address1 address2 city province zip country }
        }
      }`);
    const a = data.shop.shopAddress;
    const address = a
      ? [a.address1, a.address2, [a.city, a.province, a.zip].filter(Boolean).join(", "), a.country].filter((x): x is string => Boolean(x))
      : [];
    return { name: data.shop.name || shop, email: data.shop.email, address };
  } catch {
    return { name: shop, email: "", address: [] };
  }
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [data, from] = await Promise.all([getInvoice(session.shop, params.id!), shopDetails(admin, session.shop)]);
  if (!data) throw redirect("/app/reports");
  const { invoice, business, lines } = data;
  const rows = employeeRows(lines, invoice.basis);
  return {
    from,
    csv: invoiceCsv(data, from.name),
    invoice: {
      number: invoice.number,
      issued: DATE.format(invoice.createdAt),
      period: prettyRange(invoice.periodStart, invoice.periodEnd),
      basis: invoice.basis,
      amount: invoice.amount,
      currency: invoice.currency,
      orders: invoice.orderCount,
    },
    billTo: {
      name: business?.name ?? invoice.businessName,
      billingEmail: business?.billingEmail ?? "",
      billingAddress: business?.billingAddress ?? "",
    },
    rows,
    totals: {
      employees: new Set(rows.map((r) => r.employee)).size,
      products: rows.reduce((s, r) => s + r.products, 0),
      spend: rows.reduce((s, r) => s + r.spend, 0),
      discount: rows.reduce((s, r) => s + r.discount, 0),
    },
  };
};

// Print shows only the invoice. Plain HTML styles: it's a document the merchant sends, not app UI.
const CSS = `
@media print {
  body * { visibility: hidden !important; }
  #perks-invoice, #perks-invoice * { visibility: visible !important; }
  #perks-invoice { position: absolute; inset: 0; padding: 32px; }
}
#perks-invoice { font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #1a1a1a; }
#perks-invoice h1 { font-size: 22px; margin: 0 0 2px; letter-spacing: .02em; }
#perks-invoice .muted { color: #6b6b6b; }
#perks-invoice .head { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
#perks-invoice .meta { display: grid; grid-template-columns: auto auto; gap: 2px 16px; align-content: start; }
#perks-invoice .meta dt { color: #6b6b6b; }
#perks-invoice .meta dd { margin: 0; text-align: right; font-weight: 600; }
#perks-invoice .parties { display: flex; gap: 48px; flex-wrap: wrap; margin: 24px 0; }
#perks-invoice .label { text-transform: uppercase; font-size: 11px; letter-spacing: .06em; color: #6b6b6b; margin-bottom: 4px; }
#perks-invoice .note { background: #f6f6f7; border-radius: 8px; padding: 12px 14px; margin-bottom: 20px; }
#perks-invoice table { width: 100%; border-collapse: collapse; }
#perks-invoice th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b6b6b; padding: 8px; border-bottom: 1px solid #d4d4d4; }
#perks-invoice td { padding: 8px; border-bottom: 1px solid #ececec; }
#perks-invoice .num { text-align: right; white-space: nowrap; }
#perks-invoice tfoot td { border-bottom: none; font-weight: 600; }
#perks-invoice .due td { font-size: 15px; border-top: 2px solid #1a1a1a; }
#perks-invoice .foot { margin-top: 24px; }
`;

export default function InvoicePage() {
  const { from, invoice, billTo, rows, totals, csv } = useLoaderData<typeof loader>();
  const money = (n: number) => formatMoney(n, invoice.currency);
  const onSpend = invoice.basis === "spend";

  const download = () => {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }); // BOM so Excel reads it as UTF-8
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${invoice.number}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <s-page heading={`Invoice ${invoice.number}`}>
      <style>{CSS}</style>
      <s-link slot="breadcrumb-actions" href="/app/reports">
        Reports
      </s-link>
      <s-button slot="primary-action" variant="primary" icon="print" onClick={() => window.print()}>
        Print / Save PDF
      </s-button>
      <s-button slot="secondary-actions" icon="export" onClick={download}>
        Download for Excel (every item)
      </s-button>

      <s-section>
        <div id="perks-invoice">
          <div className="head">
            <div>
              <h1>INVOICE</h1>
              <div className="muted">Employee perks</div>
            </div>
            <dl className="meta">
              <dt>Invoice no.</dt>
              <dd>{invoice.number}</dd>
              <dt>Issue date</dt>
              <dd>{invoice.issued}</dd>
              <dt>Period</dt>
              <dd>{invoice.period}</dd>
            </dl>
          </div>

          <div className="parties">
            <div>
              <div className="label">From</div>
              <div style={{ fontWeight: 600 }}>{from.name}</div>
              {from.address.map((l) => (
                <div key={l}>{l}</div>
              ))}
              {from.email ? <div>{from.email}</div> : null}
            </div>
            <div>
              <div className="label">Bill to</div>
              <div style={{ fontWeight: 600 }}>{billTo.name}</div>
              {billTo.billingAddress ? <div style={{ whiteSpace: "pre-line" }}>{billTo.billingAddress}</div> : null}
              {billTo.billingEmail ? <div>{billTo.billingEmail}</div> : null}
            </div>
          </div>

          <div className="note">
            {billTo.name}&apos;s employees shop at {from.name} with an employee discount, as part of your employee perks
            agreement. This invoice is for{" "}
            <strong>
              {onSpend ? "the total your employees spent" : "the discount your employees received"}
            </strong>{" "}
            on {invoice.orders} order{invoice.orders === 1 ? "" : "s"} placed between {invoice.period}. The table below shows each
            employee by month; the attached spreadsheet lists every item they bought.
          </div>

          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Month</th>
                <th className="num">Orders</th>
                <th className="num">Products</th>
                <th className="num">Spend</th>
                <th className="num">Discount</th>
                <th className="num">Billed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.month} ${r.employee}`}>
                  <td>{r.employee}</td>
                  <td>{r.month}</td>
                  <td className="num">{r.orders}</td>
                  <td className="num">{r.products || "—"}</td>
                  <td className="num">{money(r.spend)}</td>
                  <td className="num">{money(r.discount)}</td>
                  <td className="num">{money(r.billed)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  {totals.employees} employee{totals.employees === 1 ? "" : "s"}
                </td>
                <td />
                <td className="num">{invoice.orders}</td>
                <td className="num">{totals.products || "—"}</td>
                <td className="num">{money(totals.spend)}</td>
                <td className="num">{money(totals.discount)}</td>
                <td className="num">{money(invoice.amount)}</td>
              </tr>
              <tr className="due">
                <td colSpan={6}>Amount due</td>
                <td className="num">{money(invoice.amount)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="foot muted">
            Spend is what employees paid for products after their discount, without shipping or tax.
            {from.email ? ` Questions about this invoice? Email ${from.email}.` : ""}
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Invoice" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
