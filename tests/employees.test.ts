import { beforeEach, expect, test } from "vitest";
import db from "../app/db.server";
import { employeesCsv, listEmployees, parseEmployeeFilter } from "../app/lib/employees.server";

const SHOP = "perks-employees.myshopify.com";
const now = new Date("2026-11-20T12:00:00Z");
let acme: string;
let beta: string;

const member = (customerId: string, workEmail: string, businessId: string, status = "active", verifiedAt = "2026-11-01") =>
  db.employeeMembership.create({
    data: { shop: SHOP, customerId, workEmail, businessId, source: "domain", status, verifiedAt: new Date(`${verifiedAt}T00:00:00Z`) },
  });
const order = (id: string, customerId: string, businessId: string, discount: number, o: { cancelled?: boolean; at?: string } = {}) =>
  db.orderUsage.create({
    data: {
      shop: SHOP,
      orderId: id,
      orderName: `#${id}`,
      customerId,
      businessId,
      processedAt: new Date(o.at ?? "2026-11-10T00:00:00Z"),
      currency: "PKR",
      spend: discount * 4,
      total: discount * 5,
      discount,
      cancelled: o.cancelled ?? false,
    },
  });

beforeEach(async () => {
  for (const m of [db.employeeMembership, db.orderUsage, db.business]) await (m as typeof db.business).deleteMany({ where: { shop: SHOP } });
  acme = (await db.business.create({ data: { shop: SHOP, name: "Acme", domains: '["acme.com"]', limitPeriod: "month", limitBasis: "discount", limitAmount: 200 } })).id;
  beta = (await db.business.create({ data: { shop: SHOP, name: "Beta", domains: '["beta.com"]' } })).id;
  await member("1", "sara@acme.com", acme, "active", "2026-11-01");
  await member("2", "ali@acme.com", acme, "active", "2026-11-05");
  await member("3", "zoe@beta.com", beta, "revoked", "2026-10-01");
  await order("a", "1", acme, 50);
  await order("b", "1", acme, 150);
  await order("c", "2", acme, 30);
  await order("d", "2", acme, 999, { cancelled: true });
  await order("e", "2", acme, 40, { at: "2026-10-10T00:00:00Z" }); // last month: counts as an order, not toward this month's limit
});

test("orders, spend and this month's limit use per employee; cancelled orders left out", async () => {
  const { rows, counts } = await listEmployees(SHOP, parseEmployeeFilter(new URLSearchParams()), now);
  expect(rows.map((r) => r.workEmail)).toEqual(["ali@acme.com", "sara@acme.com", "zoe@beta.com"]); // newest first
  const sara = rows.find((r) => r.customerId === "1")!;
  expect(sara).toMatchObject({ orders: 2, spend: 800, business: "Acme" });
  expect(sara.limit).toMatchObject({ used: 200, amount: 200, share: 1, period: "month" });
  expect(rows.find((r) => r.customerId === "2")!).toMatchObject({ orders: 2, limit: { used: 30 } });
  expect(rows.find((r) => r.customerId === "3")!.limit).toBeNull();
  expect(counts).toEqual({ all: 3, active: 2, revoked: 1 });
});

test("filters, tab counts that ignore the status filter, and sorts", async () => {
  const f = (q: string) => parseEmployeeFilter(new URLSearchParams(q));
  const active = await listEmployees(SHOP, f("status=active"), now);
  expect(active.rows).toHaveLength(2);
  expect(active.counts.all).toBe(3);
  expect((await listEmployees(SHOP, f(`business=${beta}`), now)).rows.map((r) => r.customerId)).toEqual(["3"]);
  expect((await listEmployees(SHOP, f("q=sara"), now)).rows.map((r) => r.customerId)).toEqual(["1"]);
  expect((await listEmployees(SHOP, f("sort=limit"), now)).rows[0].customerId).toBe("1");
  expect(f("sort=bogus").sort).toBe("newest");
  expect(await listEmployees("other.myshopify.com", f(""), now)).toEqual({ rows: [], counts: { all: 0 } });
});

test("Excel export", async () => {
  const { rows } = await listEmployees(SHOP, parseEmployeeFilter(new URLSearchParams()), now);
  const csv = employeesCsv(rows, "PKR");
  expect(csv).toContain("Employee email,Business,Status,Joined,Joined by,Orders,Spend (PKR),Discount (PKR),Limit,Limit used,Shopify customer ID");
  expect(csv).toContain("sara@acme.com,Acme,Active,2026-11-01,Work email,2,800.00,200.00,PKR\u00a0200 discount per month,200.00,1");
  expect(csv).toContain("zoe@beta.com,Beta,Removed,2026-10-01,Work email,0,0.00,0.00,No limit,,3");
});
