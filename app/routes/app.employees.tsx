import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { PageHelp } from "../components/ui";
import { merchantActor } from "../lib/admin-actor.server";
import { reactivateMembership, revokeMembership, syncDomainCustomers } from "../lib/membership.server";
import { authenticate } from "../shopify.server";

const PAGE = 100;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "all";
  const businessId = url.searchParams.get("business") ?? "all";
  const [members, total, businesses] = await Promise.all([
    db.employeeMembership.findMany({
      where: {
        shop: session.shop,
        ...(status !== "all" ? { status } : {}),
        ...(businessId !== "all" ? { businessId } : {}),
        ...(q ? { OR: [{ workEmail: { contains: q } }, { customerId: { contains: q } }] } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: PAGE,
    }),
    db.employeeMembership.count({ where: { shop: session.shop } }),
    db.business.findMany({ where: { shop: session.shop }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const names = new Map(businesses.map((b) => [b.id, b.name]));
  return {
    shop: session.shop,
    total,
    filtered: Boolean(q || status !== "all" || businessId !== "all"),
    businesses,
    members: members.map((m) => ({
      customerId: m.customerId,
      workEmail: m.workEmail,
      source: m.source,
      business: m.businessId ? (names.get(m.businessId) ?? "Deleted business") : "",
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
    if (!/^\d+$/.test(customerId)) return { ok: false, message: "Invalid customer" };
    if (intent === "revoke") {
      await revokeMembership(ctx.admin, ctx.session.shop, customerId, merchantActor(ctx));
      return { ok: true, message: "Perks removed" };
    }
    if (intent === "reactivate") {
      await reactivateMembership(ctx.admin, ctx.session.shop, customerId, merchantActor(ctx));
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
          <s-link href={`https://admin.shopify.com/store/${handle}/customers/${m.customerId}`} target="_blank">
            View customer
          </s-link>
        </s-stack>
      </s-table-cell>
      <s-table-cell>{m.business || "—"}</s-table-cell>
      <s-table-cell>{m.source === "domain" ? "Work-email login" : "Email link"}</s-table-cell>
      <s-table-cell>
        <s-badge tone={st.tone}>{st.label}</s-badge>
      </s-table-cell>
      <s-table-cell>{m.since}</s-table-cell>
      <s-table-cell>{m.source === "domain" ? "While email matches" : (m.expiresAt ?? "Never")}</s-table-cell>
      <s-table-cell>
        {m.status === "active" || m.status === "inactive" ? (
          <s-button
            variant="tertiary"
            tone="critical"
            {...busy}
            onClick={() => fetcher.submit({ customerId: m.customerId, intent: "revoke" }, { method: "post" })}
          >
            Remove perks
          </s-button>
        ) : (
          <s-button
            variant="tertiary"
            {...busy}
            onClick={() => fetcher.submit({ customerId: m.customerId, intent: "reactivate" }, { method: "post" })}
          >
            Restore perks
          </s-button>
        )}
      </s-table-cell>
    </s-table-row>
  );
}

export default function Employees() {
  const { members, shop, total, filtered, businesses } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const sync = useFetcher<typeof action>();
  useToastResult(sync.data);
  const status = params.get("status") ?? "all";

  return (
    <s-page heading="Employees">
      <s-button
        slot="secondary-actions"
        icon="refresh"
        onClick={() => sync.submit({ intent: "sync" }, { method: "post" })}
        {...(sync.state !== "idle" ? { loading: true } : {})}
      >
        Find existing employees
      </s-button>

      <s-stack gap="base">
        <PageHelp title="Who shows up here">
          Customers appear here when they log in with an approved work email, or verify one by email link.
          &ldquo;Find existing employees&rdquo; checks customers who signed up before you installed the app.
          <strong> Remove perks</strong> blocks a person even if their email still matches.
        </PageHelp>

        {total === 0 ? (
          <s-section>
            <s-empty-state heading="No employees yet">
              <s-paragraph>
                Employees appear here after they log in to your store with a work email, or verify one.
              </s-paragraph>
              <s-button slot="primary-action" onClick={() => sync.submit({ intent: "sync" }, { method: "post" })}>
                Find existing employees
              </s-button>
              <s-button slot="secondary-actions" href="/app/help">
                How it works
              </s-button>
            </s-empty-state>
          </s-section>
        ) : (
          <s-section padding="none">
            <s-box padding="base">
              <Form method="get">
                <s-stack direction="inline" gap="base" alignItems="end">
                  <s-box inlineSize="100%">
                    <s-search-field
                      name="q"
                      label="Search employees"
                      labelAccessibilityVisibility="exclusive"
                      placeholder="Search by email or customer ID"
                      defaultValue={params.get("q") ?? ""}
                    />
                  </s-box>
                  <s-select name="business" label="Business" labelAccessibilityVisibility="exclusive">
                    <s-option value="all" defaultSelected={(params.get("business") ?? "all") === "all"}>
                      All businesses
                    </s-option>
                    {businesses.map((b) => (
                      <s-option key={b.id} value={b.id} defaultSelected={params.get("business") === b.id}>
                        {b.name}
                      </s-option>
                    ))}
                  </s-select>
                  <s-select name="status" label="Status" labelAccessibilityVisibility="exclusive">
                    {["all", "active", "revoked", "expired", "inactive"].map((v) => (
                      <s-option key={v} value={v} defaultSelected={status === v}>
                        {v === "all" ? "All statuses" : STATUS[v].label}
                      </s-option>
                    ))}
                  </s-select>
                  <s-button type="submit">Filter</s-button>
                </s-stack>
              </Form>
            </s-box>
            {members.length ? (
              <s-table>
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
            ) : (
              <s-box padding="base">
                <s-text color="subdued">{filtered ? "No employees match your search." : "No employees."}</s-text>
              </s-box>
            )}
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
