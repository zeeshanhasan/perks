import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { PageHelp } from "../components/ui";
import { merchantActor } from "../lib/admin-actor.server";
import {
  reactivateMembership,
  revokeMembership,
  syncDomainCustomers,
} from "../lib/membership.server";
import { authenticate } from "../shopify.server";

const PAGE = 50;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "all";
  const businessId = url.searchParams.get("business") ?? "all";
  const page = Math.max(
    1,
    Math.floor(Number(url.searchParams.get("page")) || 1),
  );
  const where = {
    shop: session.shop,
    ...(status !== "all" ? { status } : {}),
    ...(businessId !== "all" ? { businessId } : {}),
    ...(q
      ? {
          OR: [{ workEmail: { contains: q } }, { customerId: { contains: q } }],
        }
      : {}),
  };
  const [members, matching, total, businesses] = await Promise.all([
    db.employeeMembership.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.employeeMembership.count({ where }),
    db.employeeMembership.count({ where: { shop: session.shop } }),
    db.business.findMany({
      where: { shop: session.shop },
      select: { id: true, name: true, archivedAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  // Deleted (archived) businesses read as "Deleted business" so their employees can't be restored to them.
  const names = new Map(businesses.map((b) => [b.id, b.archivedAt ? "Deleted business" : b.name]));
  return {
    shop: session.shop,
    total,
    matching,
    page,
    pages: Math.max(1, Math.ceil(matching / PAGE)),
    from: matching ? (page - 1) * PAGE + 1 : 0,
    to: Math.min(page * PAGE, matching),
    filtered: Boolean(q || status !== "all" || businessId !== "all"),
    businesses,
    members: members.map((m) => ({
      customerId: m.customerId,
      workEmail: m.workEmail,
      source: m.source,
      business: m.businessId
        ? (names.get(m.businessId) ?? "Deleted business")
        : "",
      status: m.status,
      since: m.verifiedAt.toISOString().slice(0, 10),
      expiresAt: m.expiresAt ? m.expiresAt.toISOString().slice(0, 10) : null,
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
        return { ok: false, message: "Their business was deleted. They can verify again with the employee link." };
      return { ok: true, message: "Perks restored" };
    }
    return { ok: false, message: "Unknown action" };
  } catch (err) {
    console.error("[perks] employee action failed", err);
    return { ok: false, message: "Something went wrong. Try again." };
  }
};

const STATUS: Record<
  string,
  { label: string; tone: "success" | "critical" | "neutral" | "warning" }
> = {
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

function Row({ m, shop }: { m: Member; shop: string }) {
  const fetcher = useFetcher<typeof action>();
  useToastResult(fetcher.data);
  const handle = shop.replace(".myshopify.com", "");
  const busy = fetcher.state !== "idle" ? { loading: true } : {};
  const st = STATUS[m.status] ?? { label: m.status, tone: "neutral" as const };
  return (
    <s-table-row>
      <s-table-cell>
        <s-stack gap="small-300">
          <s-text>{m.workEmail}</s-text>
          <s-link
            href={`https://admin.shopify.com/store/${handle}/customers/${m.customerId}`}
            target="_blank"
          >
            View customer
          </s-link>
        </s-stack>
      </s-table-cell>
      <s-table-cell>{m.business || "—"}</s-table-cell>
      <s-table-cell>
        {m.source === "domain" ? "Work-email login" : "Email link"}
      </s-table-cell>
      <s-table-cell>
        <s-badge tone={st.tone}>{st.label}</s-badge>
      </s-table-cell>
      <s-table-cell>{m.since}</s-table-cell>
      <s-table-cell>
        {m.source === "domain"
          ? "While email matches"
          : (m.expiresAt ?? "Never")}
      </s-table-cell>
      <s-table-cell>
        {m.status === "active" || m.status === "inactive" ? (
          <s-button
            variant="tertiary"
            tone="critical"
            {...busy}
            onClick={() =>
              fetcher.submit(
                { customerId: m.customerId, intent: "revoke" },
                { method: "post" },
              )
            }
          >
            Remove perks
          </s-button>
        ) : m.business === "Deleted business" ? (
          <s-text color="subdued">Business deleted</s-text>
        ) : (
          <s-button
            variant="tertiary"
            {...busy}
            onClick={() =>
              fetcher.submit(
                { customerId: m.customerId, intent: "reactivate" },
                { method: "post" },
              )
            }
          >
            Restore perks
          </s-button>
        )}
      </s-table-cell>
    </s-table-row>
  );
}

export default function Employees() {
  const {
    members,
    shop,
    total,
    matching,
    page,
    pages,
    from,
    to,
    filtered,
    businesses,
  } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  const sync = useFetcher<typeof action>();
  useToastResult(sync.data);
  const status = params.get("status") ?? "all";
  /** Change a filter (back to page 1) or the page; empty / "all" removes it from the URL. */
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const val = (e: Event) =>
    (e.currentTarget as unknown as { value: string }).value;

  return (
    <s-page heading="Employees">
      <s-button slot="secondary-actions" href="/app/check">
        Check a customer
      </s-button>
      <s-button
        slot="secondary-actions"
        icon="refresh"
        onClick={() => sync.submit({ intent: "sync" }, { method: "post" })}
        {...(sync.state !== "idle" ? { loading: true } : {})}
      >
        Find existing employees
      </s-button>

      <s-stack gap="base">
        {total === 0 ? (
          <s-section>
            <s-empty-state heading="No employees yet">
              <s-paragraph>
                Employees appear here after they log in to your store with a
                work email, or verify one.
              </s-paragraph>
              <s-button
                slot="primary-action"
                onClick={() =>
                  sync.submit({ intent: "sync" }, { method: "post" })
                }
              >
                Find existing employees
              </s-button>
              <s-button slot="secondary-actions" href="/app/help">
                How it works
              </s-button>
            </s-empty-state>
          </s-section>
        ) : (
          <s-section padding="none">
            <s-table
              paginate={pages > 1}
              hasPreviousPage={page > 1}
              hasNextPage={page < pages}
              loading={navigation.state === "loading"}
              onPreviousPage={() => update("page", String(page - 1))}
              onNextPage={() => update("page", String(page + 1))}
            >
              {/* Search and both filters in one row; selects apply straight away, search on Enter. */}
              <s-grid
                slot="filters"
                gap="small"
                alignItems="center"
                gridTemplateColumns="minmax(12rem, 2fr) minmax(9rem, 1fr) minmax(9rem, 1fr)"
              >
                <s-search-field
                  label="Search employees"
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Search by email or customer ID"
                  defaultValue={params.get("q") ?? ""}
                  onChange={(e) => update("q", val(e).trim())}
                />
                <s-select
                  label="Business"
                  labelAccessibilityVisibility="exclusive"
                  value={params.get("business") ?? "all"}
                  onChange={(e) => update("business", val(e))}
                >
                  <s-option value="all">All businesses</s-option>
                  {businesses.map((b) => (
                    <s-option key={b.id} value={b.id}>
                      {b.name}
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label="Status"
                  labelAccessibilityVisibility="exclusive"
                  value={status}
                  onChange={(e) => update("status", val(e))}
                >
                  {["all", "active", "revoked", "expired", "inactive"].map(
                    (v) => (
                      <s-option key={v} value={v}>
                        {v === "all" ? "All statuses" : STATUS[v].label}
                      </s-option>
                    ),
                  )}
                </s-select>
              </s-grid>
              <s-table-header-row>
                <s-table-header>Employee</s-table-header>
                <s-table-header>Business</s-table-header>
                <s-table-header>Joined by</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Since</s-table-header>
                <s-table-header>Expires</s-table-header>
                <s-table-header>
                  <s-text accessibilityVisibility="exclusive">Actions</s-text>
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {members.map((m) => (
                  <Row key={m.customerId} m={m} shop={shop} />
                ))}
              </s-table-body>
            </s-table>
            <s-box padding="base">
              <s-text color="subdued">
                {members.length
                  ? `Showing ${from}–${to} of ${matching.toLocaleString("en")}${filtered ? " matching" : ""} employee${matching === 1 ? "" : "s"}${pages > 1 ? ` · page ${page} of ${pages}` : ""}`
                  : filtered
                    ? "No employees match your search."
                    : "No employees."}
              </s-text>
            </s-box>
          </s-section>
        )}

        <PageHelp title="Who shows up here">
          Customers appear here when they log in with an approved work email, or
          verify one by email link. &ldquo;Find existing employees&rdquo; checks
          customers who signed up before you installed the app.
          <strong> Remove perks</strong> blocks a person even if their email
          still matches.
        </PageHelp>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
