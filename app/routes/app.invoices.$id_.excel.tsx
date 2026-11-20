import type { LoaderFunctionArgs } from "react-router";
import { getMonthlyInvoice, invoiceCsv } from "../lib/invoice.server";
import { shopDetails } from "../lib/shop-details.server";
import { authenticate } from "../shopify.server";
import { startTiming } from "../lib/timing.server";

/** GET /app/invoices/:id/excel: the invoice's every item as a CSV file Excel opens (fetched by the app with its session token). */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const t = startTiming("invoice-excel");
  const { admin, session } = await t.step("auth", () => authenticate.admin(request));
  const [data, from] = await t.step("data", () =>
    Promise.all([getMonthlyInvoice(session.shop, params.id!, admin), shopDetails(admin, session.shop)]),
  );
  t.done(`shop=${session.shop} found=${Boolean(data)} lines=${data?.lines.length ?? 0}`);
  if (!data) return new Response("Not found", { status: 404 });
  // BOM so Excel reads it as UTF-8.
  return new Response("﻿" + invoiceCsv(data, from.name), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.invoice.number}.csv"`,
      "Cache-Control": "no-store",
    },
  });
};
