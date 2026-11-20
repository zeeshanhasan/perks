import type { LoaderFunctionArgs } from "react-router";
import { shopInfo } from "../lib/catalog.server";
import { employeesCsv, listEmployees, parseEmployeeFilter } from "../lib/employees.server";
import { authenticate } from "../shopify.server";

/** GET /app/employees/excel?…filters: the filtered employee list as a CSV file Excel opens. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const filter = parseEmployeeFilter(new URL(request.url).searchParams);
  const [{ rows }, info] = await Promise.all([listEmployees(session.shop, filter), shopInfo(admin, session.shop)]);
  const date = new Date().toISOString().slice(0, 10);
  // BOM so Excel reads it as UTF-8.
  return new Response("﻿" + employeesCsv(rows, info.currency), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
};
