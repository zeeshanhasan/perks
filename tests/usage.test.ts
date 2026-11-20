/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, test } from "vitest";
import db from "../app/db.server";
import {
  employeeRows,
  ensureInvoices,
  getMonthlyInvoice,
  invoiceCsv,
  invoiceStatus,
  listMonthlyInvoices,
  businessSummary,
} from "../app/lib/invoice.server";
import { csvEscape, rangeFor } from "../app/lib/report";
import { buildUsage, perksDiscountOf } from "../app/lib/usage";
import { cancelOrder, recordOrder, updateOrder } from "../app/lib/usage.server";
import { fakeAdmin } from "./fake-admin";

const SHOP = "perks-usage.myshopify.com";
let tofo: string;

const order = (
  id: number,
  email: string,
  customerId: number,
  o: Record<string, any> = {},
) => ({
  id,
  name: `#${id}`,
  processed_at: "2026-11-02T10:00:00Z",
  currency: "PKR",
  subtotal_price: "850.00",
  total_price: "1050.00",
  customer: { id: customerId, email },
  discount_applications: [
    { type: "automatic", title: "Employee perks" },
    { type: "discount_code", title: "SALE10" },
  ],
  line_items: [
    {
      title: "Vitamin C",
      variant_title: "60 tabs",
      sku: "VC-60",
      vendor: "Acme Labs",
      product_id: 501,
      quantity: 2,
      price: "500.00",
      discount_allocations: [
        { amount: "150.00", discount_application_index: 0 },
      ],
    },
    {
      title: "Hand cream",
      variant_title: null,
      sku: "",
      quantity: 1,
      price: "50.00",
      discount_allocations: [
        { amount: "50.00", discount_application_index: 1 },
      ],
    },
  ],
  ...o,
});

beforeEach(async () => {
  for (const m of [
    db.business,
    db.benefitPolicy,
    db.orderUsage,
    db.invoice,
    db.employeeMembership,
  ] as any[])
    await m.deleteMany({ where: { shop: SHOP } });
  await db.benefitPolicy.create({
    data: { shop: SHOP, enabled: true, autoDomain: true },
  });
  tofo = (
    await db.business.create({
      data: {
        shop: SHOP,
        name: "Tofo",
        domains: '["tofoapp.com"]',
        billingEmail: "hr@tofoapp.com",
      },
    })
  ).id;
  await db.business.create({
    data: { shop: SHOP, name: "Google", domains: '["google.com"]' },
  });
});

test("only our discount is counted", () => {
  expect(perksDiscountOf(order(1, "a@tofoapp.com", 1))).toBe(150);
  expect(perksDiscountOf({ discount_applications: [], line_items: [] })).toBe(
    0,
  );
});

test("employee orders are recorded per business and usage is published for limits", async () => {
  const { admin, mf } = fakeAdmin();
  expect(await recordOrder(SHOP, order(1, "a@tofoapp.com", 11), admin)).toBe(
    "recorded",
  );
  expect(
    await recordOrder(
      SHOP,
      order(2, "b@google.com", 12, { subtotal_price: "1000" }),
      admin,
    ),
  ).toBe("recorded");
  expect(await recordOrder(SHOP, order(3, "c@gmail.com", 13), admin)).toBe(
    "skipped",
  );
  expect(await recordOrder(SHOP, order(1, "a@tofoapp.com", 11), admin)).toBe(
    "recorded",
  ); // webhook retry: no duplicate
  expect(await db.orderUsage.count({ where: { shop: SHOP } })).toBe(2);

  const usage = mf("gid://shopify/Customer/11", "perks_usage");
  expect(usage.b[tofo]).toMatchObject({ md: 150, ms: 850 });
  expect(usage.m).toMatch(/^\d{4}-\d{2}$/);
});

test("revoked employees aren't billed to the business", async () => {
  await db.employeeMembership.create({
    data: {
      shop: SHOP,
      customerId: "11",
      workEmail: "a@tofoapp.com",
      businessId: tofo,
      source: "domain",
      status: "revoked",
      verifiedAt: new Date(),
    },
  });
  expect(await recordOrder(SHOP, order(1, "a@tofoapp.com", 11), null)).toBe(
    "skipped",
  );
});

test("cancelled orders drop out of reports and usage", async () => {
  const { admin, mf } = fakeAdmin();
  await recordOrder(SHOP, order(1, "a@tofoapp.com", 11), admin);
  await cancelOrder(SHOP, { id: 1 }, admin);
  const r = rangeFor("custom", new Date(), "2026-11-01", "2026-11-30");
  expect((await businessSummary(SHOP, r.from, r.to)).totals.orders).toBe(0);
  expect(mf("gid://shopify/Customer/11", "perks_usage").b).toEqual({});
});

test("buildUsage splits month and year", () => {
  const u = buildUsage(
    [
      {
        businessId: "b",
        processedAt: new Date("2026-11-02"),
        spend: 100,
        discount: 10,
      },
      {
        businessId: "b",
        processedAt: new Date("2026-10-15"),
        spend: 50,
        discount: 5,
      },
      {
        businessId: "b",
        processedAt: new Date("2025-12-31"),
        spend: 999,
        discount: 99,
      },
    ],
    new Date("2026-11-20"),
  );
  expect(u).toEqual({
    v: 1,
    m: "2026-11",
    y: "2026",
    b: { b: { md: 10, ms: 100, yd: 15, ys: 150 } },
  });
});

test("summary counts placed and fulfilled orders", async () => {
  await recordOrder(SHOP, order(1, "a@tofoapp.com", 11, { fulfillment_status: "fulfilled" }), null);
  await recordOrder(SHOP, order(2, "x@tofoapp.com", 12, { processed_at: "2026-11-20T10:00:00Z" }), null);
  await recordOrder(SHOP, order(3, "b@google.com", 13), null);
  const r = rangeFor("custom", new Date(), "2026-11-01", "2026-11-30");
  const s = await businessSummary(SHOP, r.from, r.to);
  expect(s.lines.find((l) => l.businessId === tofo)).toMatchObject({
    orders: 2,
    fulfilled: 1,
    employees: 2,
    spend: 1700,
    discount: 300,
  });
  expect(s.totals).toMatchObject({ orders: 3, fulfilled: 1, employees: 3, discount: 450 });
});

test("orders/updated keeps fulfilment, amounts and cancellation current; unknown orders are skipped", async () => {
  await recordOrder(SHOP, order(1, "a@tofoapp.com", 11), null);
  expect((await db.orderUsage.findFirst({ where: { shop: SHOP } }))!.fulfillment).toBe("unfulfilled");
  expect(await updateOrder(SHOP, order(1, "a@tofoapp.com", 11, { fulfillment_status: "partial" }), null)).toBe("updated");
  expect((await db.orderUsage.findFirst({ where: { shop: SHOP } }))!.fulfillment).toBe("partial");
  await updateOrder(SHOP, order(1, "a@tofoapp.com", 11, { fulfillment_status: "fulfilled", subtotal_price: "700" }), null);
  expect(await db.orderUsage.findFirst({ where: { shop: SHOP } })).toMatchObject({ fulfillment: "fulfilled", spend: 700 });
  await updateOrder(SHOP, order(1, "a@tofoapp.com", 11, { cancelled_at: "2026-11-03T00:00:00Z" }), null);
  expect((await db.orderUsage.findFirst({ where: { shop: SHOP } }))!.cancelled).toBe(true);
  expect(await updateOrder(SHOP, order(9, "z@tofoapp.com", 19), null)).toBe("skipped");
});

test("one live invoice per business per month: due once fulfilled, cancelled orders drop out", async () => {
  await db.business.update({ where: { id: tofo }, data: { billFor: "discount" } });
  await recordOrder(SHOP, order(1, "a@tofoapp.com", 11, { fulfillment_status: "fulfilled" }), null);
  await recordOrder(SHOP, order(2, "x@tofoapp.com", 12, { processed_at: "2026-11-20T10:00:00Z" }), null);
  await recordOrder(SHOP, order(3, "b@google.com", 13), null);
  await recordOrder(SHOP, order(4, "a@tofoapp.com", 11, { processed_at: "2026-10-05T10:00:00Z", fulfillment_status: "fulfilled" }), null);
  await ensureInvoices(SHOP);
  await ensureInvoices(SHOP); // idempotent
  const now = new Date("2026-11-25T00:00:00Z");
  const all = await listMonthlyInvoices(SHOP, {}, now);
  expect(all.map((i) => [i.number, i.business, i.month])).toEqual([
    ["INV-202611-001", "Tofo", "2026-11"],
    ["INV-202611-002", "Google", "2026-11"],
    ["INV-202610-001", "Tofo", "2026-10"],
  ]);
  const nov = all[0];
  expect(nov).toMatchObject({ orders: 2, fulfilled: 1, due: 150, inProcess: 150, status: "open" });
  expect(all[2]).toMatchObject({ due: 150, inProcess: 0, status: "ready" });
  expect(await listMonthlyInvoices(SHOP, { businessId: tofo, fromMonth: "2026-11", toMonth: "2026-11" }, now)).toHaveLength(1);

  // Fulfilled later: becomes due. Spend billing: billed on what they paid.
  await updateOrder(SHOP, order(2, "x@tofoapp.com", 12, { processed_at: "2026-11-20T10:00:00Z", fulfillment_status: "fulfilled" }), null);
  await db.business.update({ where: { id: tofo }, data: { billFor: "spend" } });
  expect((await listMonthlyInvoices(SHOP, { businessId: tofo, fromMonth: "2026-11" }, now))[0]).toMatchObject({ due: 1700, inProcess: 0 });

  // Cancelled: drops out, number kept.
  await cancelOrder(SHOP, { id: 2 }, null);
  const inv = (await getMonthlyInvoice(SHOP, nov.id, null, now))!;
  expect(inv.invoice.number).toBe("INV-202611-001");
  expect(inv.lines).toHaveLength(1);
  expect(inv.due).toBe(850);
  const csv = invoiceCsv(inv, "Test Store");
  expect(csv).toContain("Invoice,Business,Employee email,Month,Order,Order date,Order status,Product,Variant,SKU,Vendor,Type,Quantity");
  expect(csv).toContain("INV-202611-001,Tofo,a@tofoapp.com,November 2026,#1,2026-11-02,Fulfilled,Vitamin C,60 tabs,VC-60,Acme Labs,,2,500.00,1000.00,150.00,850.00,850.00,Yes");
  expect(csv).not.toMatch(/Customer ID/);
  const rows = employeeRows(inv.lines, inv.billFor);
  expect(rows).toEqual([{ employee: "a@tofoapp.com", orders: 1, fulfilled: 1, products: 3, spend: 850, discount: 150, inProcess: 0, due: 850 }]);
  expect(await getMonthlyInvoice("other.myshopify.com", nov.id)).toBeNull(); // shop isolation
});

test("invoice status", () => {
  expect(invoiceStatus("2026-11", 2, 1, new Date("2026-11-30T23:00:00Z"))).toBe("open");
  expect(invoiceStatus("2026-11", 2, 1, new Date("2026-12-01T00:00:00Z"))).toBe("waiting");
  expect(invoiceStatus("2026-11", 2, 2, new Date("2026-12-01T00:00:00Z"))).toBe("ready");
});

test("date ranges", () => {
  const now = new Date("2026-11-04T12:00:00Z"); // Wednesday
  const ymd = (r: { from: Date; to: Date }) => [
    r.from.toISOString().slice(0, 10),
    r.to.toISOString().slice(0, 10),
  ];
  expect(ymd(rangeFor("this_week", now))).toEqual(["2026-11-02", "2026-11-09"]);
  expect(ymd(rangeFor("last_week", now))).toEqual(["2026-10-26", "2026-11-02"]);
  expect(ymd(rangeFor("this_month", now))).toEqual([
    "2026-11-01",
    "2026-12-01",
  ]);
  expect(ymd(rangeFor("last_month", now))).toEqual([
    "2026-10-01",
    "2026-11-01",
  ]);
  expect(ymd(rangeFor("custom", now, "2026-11-03", "2026-11-03"))).toEqual([
    "2026-11-03",
    "2026-11-04",
  ]);
  expect(rangeFor("custom", now, "2026-11-05", "2026-11-01").label).toBe(
    "This month",
  ); // invalid → default
});

test("CSV cells are escaped and formula-safe", () => {
  expect(csvEscape("a,b")).toBe('"a,b"');
  expect(csvEscape('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  expect(csvEscape("plain")).toBe("plain");
});
