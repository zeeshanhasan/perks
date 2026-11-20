import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { formatMoney } from "../lib/business";
import { STATUS_BADGE, downloadInvoiceExcel } from "../lib/invoice-ui";
import { STATUS_LABEL, billedOf, employeeRows, getMonthlyInvoice, isDue, monthLabel } from "../lib/invoice.server";
import { shopDetails } from "../lib/shop-details.server";
import { authenticate } from "../shopify.server";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  // No admin here: item details (vendor, type) are only needed for Excel, and fetching them would slow the page.
  const [data, from] = await Promise.all([getMonthlyInvoice(session.shop, params.id!), shopDetails(admin, session.shop)]);
  if (!data) throw redirect("/app/reports");
  const { invoice, business, lines, billFor } = data;
  const rows = employeeRows(lines, billFor);
  return {
    from,
    invoice: {
      id: invoice.id,
      number: invoice.number,
      month: monthLabel(invoice.month),
      issued: DATE.format(new Date()),
      billFor,
      currency: data.currency,
      due: data.due,
      inProcess: data.inProcess,
      status: data.status,
    },
    billTo: {
      name: business?.name ?? invoice.businessName,
      billingEmail: business?.billingEmail ?? "",
      billingAddress: business?.billingAddress ?? "",
    },
    rows,
    orders: lines.map((l) => ({
      name: l.orderName,
      date: l.date,
      employee: l.email || "Employee (email not recorded)",
      status: STATUS_LABEL[l.fulfillment] ?? l.fulfillment,
      due: isDue(l),
      billed: billedOf(billFor, l),
    })),
    totals: {
      employees: rows.length,
      orders: lines.length,
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
#perks-invoice h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #6b6b6b; margin: 28px 0 4px; }
#perks-invoice .pending { color: #8a6116; }
`;

export default function InvoicePage() {
  const { from, invoice, billTo, rows, orders, totals } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const [params] = useSearchParams();
  const money = (n: number) => formatMoney(n, invoice.currency);
  const onSpend = invoice.billFor === "spend";
  const badge = STATUS_BADGE[invoice.status];
  const waiting = orders.filter((o) => !o.due).length;

  // "PDF" from the Reports list opens this page with ?print=1.
  useEffect(() => {
    if (params.get("print") === "1") setTimeout(() => window.print(), 300);
  }, [params]);

  const download = () =>
    downloadInvoiceExcel(invoice.id, invoice.number).catch(() => shopify.toast.show("Couldn't download the Excel file. Try again.", { isError: true }));

  return (
    <s-page heading={`Invoice ${invoice.number}`}>
      <style>{CSS}</style>
      <s-link slot="breadcrumb-actions" href="/app/reports">
        Reports
      </s-link>
      <s-badge slot="accessory" tone={badge.tone}>
        {badge.label}
      </s-badge>
      <s-button slot="primary-action" variant="primary" icon="print" onClick={() => window.print()}>
        Print / Save PDF
      </s-button>
      <s-button slot="secondary-actions" icon="export" onClick={download}>
        Download Excel
      </s-button>

      {invoice.status !== "ready" ? (
        <s-banner tone={invoice.status === "open" ? "info" : "warning"}>
          {invoice.status === "open"
            ? `This invoice keeps updating until ${invoice.month} is over: new orders are added, cancelled ones drop out.`
            : `${waiting} order${waiting === 1 ? " isn't" : "s aren't"} fulfilled yet. ${waiting === 1 ? "It's" : "They're"} added to the amount due once fulfilled.`}
        </s-banner>
      ) : null}

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
              <dt>Date</dt>
              <dd>{invoice.issued}</dd>
              <dt>Month</dt>
              <dd>{invoice.month}</dd>
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
            <strong>{onSpend ? "the total your employees spent" : "the discount your employees received"}</strong> in{" "}
            {invoice.month}. Orders are due once they&apos;re fulfilled; cancelled orders aren&apos;t billed. The attached
            spreadsheet lists every item.
          </div>

          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th className="num">Orders</th>
                <th className="num">Products</th>
                <th className="num">Spend</th>
                <th className="num">Discount</th>
                <th className="num">In process</th>
                <th className="num">Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee}>
                  <td>{r.employee}</td>
                  <td className="num">{r.orders}</td>
                  <td className="num">{r.products || "—"}</td>
                  <td className="num">{money(r.spend)}</td>
                  <td className="num">{money(r.discount)}</td>
                  <td className="num">{r.inProcess ? money(r.inProcess) : "—"}</td>
                  <td className="num">{money(r.due)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  {totals.employees} employee{totals.employees === 1 ? "" : "s"}
                </td>
                <td className="num">{totals.orders}</td>
                <td className="num">{totals.products || "—"}</td>
                <td className="num">{money(totals.spend)}</td>
                <td className="num">{money(totals.discount)}</td>
                <td className="num">{invoice.inProcess ? money(invoice.inProcess) : "—"}</td>
                <td className="num">{money(invoice.due)}</td>
              </tr>
              <tr className="due">
                <td colSpan={6}>Amount due</td>
                <td className="num">{money(invoice.due)}</td>
              </tr>
            </tfoot>
          </table>

          <h2>Orders</h2>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Employee</th>
                <th>Status</th>
                <th className="num">Billed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.name}>
                  <td>{o.name}</td>
                  <td>{o.date}</td>
                  <td>{o.employee}</td>
                  <td className={o.due ? undefined : "pending"}>{o.status}</td>
                  <td className="num">{money(o.billed)}</td>
                </tr>
              ))}
            </tbody>
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
