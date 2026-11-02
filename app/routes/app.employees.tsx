import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { merchantActor } from "../lib/admin-actor.server";
import { reactivateMembership, revokeMembership } from "../lib/membership.server";
import { authenticate } from "../shopify.server";

const PAGE = 50;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "all";
  const members = await db.employeeMembership.findMany({
    where: {
      shop: session.shop,
      ...(status !== "all" ? { status } : {}),
      ...(q ? { OR: [{ workEmail: { contains: q } }, { customerId: { contains: q } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: PAGE,
  });
  return {
    shop: session.shop,
    members: members.map((m) => ({
      customerId: m.customerId,
      workEmail: m.workEmail,
      status: m.status,
      verifiedAt: m.verifiedAt.toISOString().slice(0, 10),
      expiresAt: m.expiresAt ? m.expiresAt.toISOString().slice(0, 10) : "No expiry",
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const form = await request.formData();
  const customerId = String(form.get("customerId") ?? "");
  const intent = String(form.get("intent") ?? "");
  if (!/^\d+$/.test(customerId)) return { ok: false, message: "Invalid customer" };
  try {
    if (intent === "revoke") await revokeMembership(ctx.admin, ctx.session.shop, customerId, merchantActor(ctx));
    else if (intent === "reactivate")
      await reactivateMembership(ctx.admin, ctx.session.shop, customerId, merchantActor(ctx));
    else return { ok: false, message: "Unknown action" };
    return { ok: true, message: intent === "revoke" ? "Employee revoked" : "Employee reactivated" };
  } catch (err) {
    console.error("[perks] employee action failed", err);
    return { ok: false, message: "Action failed. Try again." };
  }
};

const TONE: Record<string, "success" | "critical" | "neutral"> = {
  active: "success",
  revoked: "critical",
  expired: "neutral",
};

function Row({ m, shop }: { m: Awaited<ReturnType<typeof loader>>["members"][number]; shop: string }) {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.data) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);
  const handle = shop.replace(".myshopify.com", "");
  const busy = fetcher.state !== "idle" ? { loading: true } : {};
  return (
    <s-table-row>
      <s-table-cell>{m.workEmail}</s-table-cell>
      <s-table-cell>
        <s-link href={`https://admin.shopify.com/store/${handle}/customers/${m.customerId}`} target="_blank">
          {m.customerId}
        </s-link>
      </s-table-cell>
      <s-table-cell>
        <s-badge tone={TONE[m.status] ?? "neutral"}>{m.status}</s-badge>
      </s-table-cell>
      <s-table-cell>{m.verifiedAt}</s-table-cell>
      <s-table-cell>{m.expiresAt}</s-table-cell>
      <s-table-cell>
        {m.status === "active" ? (
          <s-button
            tone="critical"
            {...busy}
            onClick={() => fetcher.submit({ customerId: m.customerId, intent: "revoke" }, { method: "post" })}
          >
            Revoke
          </s-button>
        ) : (
          <s-button
            {...busy}
            onClick={() => fetcher.submit({ customerId: m.customerId, intent: "reactivate" }, { method: "post" })}
          >
            Reactivate
          </s-button>
        )}
      </s-table-cell>
    </s-table-row>
  );
}

export default function Employees() {
  const { members, shop } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  return (
    <s-page heading="Employees">
      <s-section>
        <Form method="get">
          <s-stack direction="inline" gap="base">
            <s-search-field name="q" label="Search" labelAccessibilityVisibility="exclusive" placeholder="Work email or customer ID" defaultValue={params.get("q") ?? ""} />
            <s-select name="status" label="Status" labelAccessibilityVisibility="exclusive">
              <s-option value="all" defaultSelected={(params.get("status") ?? "all") === "all"}>All</s-option>
              <s-option value="active" defaultSelected={(params.get("status") ?? "all") === "active"}>Active</s-option>
              <s-option value="revoked" defaultSelected={(params.get("status") ?? "all") === "revoked"}>Revoked</s-option>
              <s-option value="expired" defaultSelected={(params.get("status") ?? "all") === "expired"}>Expired</s-option>
            </s-select>
            <s-button type="submit">Filter</s-button>
          </s-stack>
        </Form>
      </s-section>
      <s-section padding="none">
        {members.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header>Work email</s-table-header>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Verified</s-table-header>
              <s-table-header>Expires</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {members.map((m) => (
                <Row key={m.customerId} m={m} shop={shop} />
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="base">
            <s-paragraph>No employees yet. They appear here after verifying their work email.</s-paragraph>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
