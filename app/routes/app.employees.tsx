import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { merchantActor } from "../lib/admin-actor.server";
import { formatMoney } from "../lib/business";
import { shopInfo } from "../lib/catalog.server";
import { listEmployees, parseEmployeeFilter } from "../lib/employees.server";
import { downloadFile } from "../lib/invoice-ui";
import { reactivateMembership, revokeMembership, syncDomainCustomers } from "../lib/membership.server";
import db from "../db.server";
import { authenticate } from "../shopify.server";

const PAGE = 50;
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const filter = parseEmployeeFilter(url.searchParams);
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
  const [{ rows, counts }, info, businesses] = await Promise.all([
    listEmployees(session.shop, filter),
    shopInfo(admin, session.shop),
    db.business.findMany({
      where: { shop: session.shop, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  return {
    shop: session.shop,
    currency: info.currency,
    counts,
    page,
    pages,
    matching: rows.length,
    businesses,
    members: rows.slice((page - 1) * PAGE, page * PAGE).map((r) => ({
      customerId: r.customerId,
      workEmail: r.workEmail,
      source: r.source,
      business: r.business,
      businessDeleted: r.businessDeleted,
      status: r.status,
      joined: DATE.format(r.joined),
      orders: r.orders,
      spend: r.spend,
      limit: r.limit,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  try {
    if (intent === "sync") {
      const r = await syncDomainCustomers(ctx.admin, ctx.session.shop);
      return {
        ok: true,
        message: r.added
          ? `Found ${r.added} new employee${r.added === 1 ? "" : "s"}`
          : `No new employees found (checked ${r.scanned} customers)`,
      };
    }
    const customerId = String(form.get("customerId") ?? "");
    if (!/^\d+$/.test(customerId))
      return { ok: false, message: "Invalid customer" };
    if (intent === "revoke") {
      await revokeMembership(
        ctx.admin,
        ctx.session.shop,
        customerId,
        merchantActor(ctx),
      );
      return { ok: true, message: "Perks removed" };
    }
    if (intent === "reactivate") {
      const r = await reactivateMembership(
        ctx.admin,
        ctx.session.shop,
        customerId,
        merchantActor(ctx),
      );
      if (r === "business_deleted")
        return { ok: false, message: "Their business was deleted. They can log in with their work email to join another business." };
      return { ok: true, message: "Perks restored" };
    }
    return { ok: false, message: "Unknown action" };
  } catch (err) {
    console.error("[perks] employee action failed", err);
    return { ok: false, message: "Something went wrong. Try again." };
  }
};

const STATUS: Record<string, { label: string; tone: "success" | "critical" | "neutral" | "warning" }> = {
  active: { label: "Active", tone: "success" },
  revoked: { label: "Removed", tone: "critical" },
  expired: { label: "Expired", tone: "neutral" },
  inactive: { label: "Not eligible", tone: "warning" },
};

type Member = Awaited<ReturnType<typeof loader>>["members"][number];

function useToastResult(data: { ok: boolean; message: string } | undefined) {
  const shopify = useAppBridge();
  useEffect(() => {
    if (data) shopify.toast.show(data.message, { isError: !data.ok });
  }, [data, shopify]);
}

function Row({ m, shop, currency }: { m: Member; shop: string; currency: string }) {
  const fetcher = useFetcher<typeof action>();
  useToastResult(fetcher.data);
  const handle = shop.replace(".myshopify.com", "");
  const busy = fetcher.state !== "idle" ? { loading: true } : {};
  const st = STATUS[m.status] ?? { label: m.status, tone: "neutral" as const };
  const money = (n: number) => formatMoney(n, currency);
  const submit = (intent: string) => fetcher.submit({ customerId: m.customerId, intent }, { method: "post" });
  return (
    <s-table-row>
      <s-table-cell>
        <s-stack gap="small-300">
          <s-text>{m.workEmail}</s-text>
          <s-link href={`https://admin.shopify.com/store/${handle}/customers/${m.customerId}`} target="_blank">
            View customer
          </s-link>
        </s-stack>
      </s-table-cell>
      <s-table-cell>{m.business || "—"}</s-table-cell>
      <s-table-cell>
        <s-stack gap="small-300">
          <s-text>{m.joined}</s-text>
          {/* Domain members are added on login, by staff creating the customer, or by "Find existing employees". */}
          <s-text color="subdued">{m.source === "domain" ? "by work email" : "by email link"}</s-text>
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        {m.orders ? (
          <s-stack gap="small-300">
            <s-text>{m.orders}</s-text>
            <s-text color="subdued">{money(m.spend)}</s-text>
          </s-stack>
        ) : (
          "—"
        )}
      </s-table-cell>
      <s-table-cell>
        {m.limit ? (
          <s-stack gap="small-300">
            <s-text>
              {money(m.limit.used)} of {money(m.limit.amount)}
            </s-text>
            {m.limit.share >= 1 ? (
              <s-badge tone="warning">At limit</s-badge>
            ) : (
              <s-text color="subdued">
                {m.limit.basis === "spend" ? "spend" : "discount"} this {m.limit.period}
              </s-text>
            )}
          </s-stack>
        ) : (
          <s-text color="subdued">No limit</s-text>
        )}
      </s-table-cell>
      <s-table-cell>
        <s-badge tone={st.tone}>{st.label}</s-badge>
      </s-table-cell>
      <s-table-cell>
        {m.status === "active" || m.status === "inactive" ? (
          <s-button variant="tertiary" tone="critical" {...busy} onClick={() => submit("revoke")}>
            Remove
          </s-button>
        ) : m.businessDeleted ? (
          <s-text color="subdued">Business deleted</s-text>
        ) : (
          <s-button variant="tertiary" {...busy} onClick={() => submit("reactivate")}>
            Restore
          </s-button>
        )}
      </s-table-cell>
    </s-table-row>
  );
}

const TABS = [
  ["all", "All"],
  ["active", "Active"],
  ["revoked", "Removed"],
  ["inactive", "Not eligible"],
  ["expired", "Expired"],
] as const;

export default function Employees() {
  const { members, shop, currency, counts, page, pages, matching, businesses } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const sync = useFetcher<typeof action>();
  useToastResult(sync.data);
  const status = params.get("status") ?? "all";
  /** Change a filter (back to page 1) or the page; empty / default removes it from the URL. */
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || (key === "sort" && value === "newest")) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { preventScrollReset: true });
  };
  const val = (e: Event) => (e.currentTarget as unknown as { value: string }).value;
  const findExisting = () => sync.submit({ intent: "sync" }, { method: "post" });
  const exportExcel = () => {
    const q = new URLSearchParams(params);
    q.delete("page");
    downloadFile(`/app/employees/excel?${q}`, `employees-${new Date().toISOString().slice(0, 10)}.csv`).catch(() =>
      shopify.toast.show("Couldn't download the Excel file. Try again.", { isError: true }),
    );
  };

  return (
    <s-page heading="Employees">
      <s-button slot="secondary-actions" icon="export" onClick={exportExcel} disabled={!counts.all}>
        Export to Excel
      </s-button>
      <s-button slot="secondary-actions" href="/app/check">
        Check a customer
      </s-button>
      <s-button slot="secondary-actions" icon="refresh" onClick={findExisting} {...(sync.state !== "idle" ? { loading: true } : {})}>
        Find existing employees
      </s-button>

      {counts.all === 0 && !params.toString() ? (
        <s-section>
          <s-empty-state heading="No employees yet">
            <s-paragraph>Employees appear here after they log in to your store with a work email.</s-paragraph>
            <s-button slot="primary-action" onClick={findExisting}>
              Find existing employees
            </s-button>
            <s-button slot="secondary-actions" href="/app/help">
              How it works
            </s-button>
          </s-empty-state>
        </s-section>
      ) : (
        <s-section padding="none">
          <s-box padding="small-200" paddingInline="base">
            <s-button-group gap="none" accessibilityLabel="Status">
              {TABS.filter(([v]) => v === "all" || v === "active" || counts[v]).map(([v, label]) => (
                <s-press-button key={v} slot="secondary-actions" pressed={status === v} onClick={() => update("status", v)}>
                  {label} {counts[v] ?? 0}
                </s-press-button>
              ))}
            </s-button-group>
          </s-box>
          <s-table
            paginate={pages > 1}
            hasPreviousPage={page > 1}
            hasNextPage={page < pages}
            loading={navigation.state === "loading"}
            onPreviousPage={() => update("page", String(page - 1))}
            onNextPage={() => update("page", String(page + 1))}
          >
            {/* One row: search grows, the two selects keep their size. Selects apply straight away, search on Enter. */}
            <s-grid slot="filters" gap="small" alignItems="center" gridTemplateColumns="minmax(0, 1fr) minmax(140px, 220px) minmax(140px, 200px)">
              <s-search-field
                label="Search employees"
                labelAccessibilityVisibility="exclusive"
                placeholder="Search by email or customer ID"
                defaultValue={params.get("q") ?? ""}
                onChange={(e) => update("q", val(e).trim())}
              />
              <s-select label="Business" labelAccessibilityVisibility="exclusive" value={params.get("business") ?? "all"} onChange={(e) => update("business", val(e))}>
                <s-option value="all">All businesses</s-option>
                {businesses.map((b) => (
                  <s-option key={b.id} value={b.id}>
                    {b.name}
                  </s-option>
                ))}
              </s-select>
              <s-select label="Sort" labelAccessibilityVisibility="exclusive" value={params.get("sort") ?? "newest"} onChange={(e) => update("sort", val(e))}>
                <s-option value="newest">Newest first</s-option>
                <s-option value="orders">Most orders</s-option>
                <s-option value="limit">Closest to limit</s-option>
              </s-select>
            </s-grid>
            <s-table-header-row>
              <s-table-header listSlot="primary">Employee</s-table-header>
              <s-table-header listSlot="secondary">Business</s-table-header>
              <s-table-header listSlot="labeled">Joined</s-table-header>
              <s-table-header listSlot="labeled">Orders</s-table-header>
              <s-table-header listSlot="labeled">Limit</s-table-header>
              <s-table-header listSlot="inline">Status</s-table-header>
              <s-table-header>
                <s-text accessibilityVisibility="exclusive">Actions</s-text>
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {members.map((m) => (
                <Row key={m.customerId} m={m} shop={shop} currency={currency} />
              ))}
            </s-table-body>
          </s-table>
          {!members.length ? (
            <s-box padding="base">
              <s-text color="subdued">No employees match.</s-text>
            </s-box>
          ) : pages > 1 ? (
            <s-box padding="base">
              <s-text color="subdued">
                Page {page} of {pages} · {matching.toLocaleString("en")} employees
              </s-text>
            </s-box>
          ) : null}
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

export function ErrorBoundary() {
  return <RouteError heading="Employees" />;
}
