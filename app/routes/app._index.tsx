import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { formatMoney } from "../lib/business";
import { shopCurrency } from "../lib/catalog.server";
import type { Trend } from "../lib/home";
import { countLine, monthOptions, plural, trend } from "../lib/home";
import { getSetup } from "../lib/setup.server";
import { embedStatus } from "../lib/storefront.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const month = new URL(request.url).searchParams.get("month");
  const { currency } = await shopCurrency(admin);
  const embed = await embedStatus(admin);
  const setup = await getSetup(session.shop, process.env.SHOPIFY_API_KEY || "", currency, embed.on, month);
  return { currency, embedOn: embed.on, months: monthOptions(), ...setup };
};

/** App Bridge's Sidekick Launch API. Not in our installed types yet; App Bridge itself loads from Shopify's CDN. */
type SidekickApi = { isEnabled: () => Promise<boolean>; open: () => Promise<unknown> };

function useSidekick() {
  const shopify = useAppBridge() as unknown as { sidekick?: SidekickApi };
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    shopify.sidekick
      ?.isEnabled()
      .then((on) => live && setEnabled(Boolean(on)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [shopify]);
  return enabled ? () => void shopify.sidekick?.open().catch(() => {}) : null;
}

function Metric({ id, label, value, sub, help, change }: { id: string; label: string; value: string; sub?: string; help: string; change: Trend }) {
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text color="subdued">{label}</s-text>
          <s-icon type="info" tone="neutral" size="small" interestFor={`tip-${id}`} />
          <s-tooltip id={`tip-${id}`}>{help}</s-tooltip>
        </s-stack>
        <s-stack direction="inline" gap="small-200" alignItems="baseline">
          <s-heading>{value}</s-heading>
          {sub ? <s-text color="subdued">{sub}</s-text> : null}
        </s-stack>
        <s-stack direction="inline" gap="small-300" alignItems="center">
          {change.dir !== "flat" ? (
            <s-icon
              type={change.dir === "up" ? "arrow-up" : "arrow-down"}
              tone={change.dir === "up" ? "success" : "critical"}
              size="small"
            />
          ) : null}
          <s-text color="subdued">{change.text}</s-text>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

type Row = {
  icon: "store" | "person" | "theme" | "page" | "chart-vertical";
  title: string;
  status: string;
  badge?: { label: string; tone: "success" | "warning" | "neutral" };
  href: string;
};

function ManageRow({ row }: { row: Row }) {
  // Client-side navigation: a plain href on s-clickable reloads the iframe without the embedded params (404).
  const navigate = useNavigate();
  return (
    <s-clickable onClick={() => navigate(row.href)} paddingBlock="small" paddingInline="small-100" borderRadius="base" accessibilityLabel={row.title}>
      <s-grid gridTemplateColumns="auto 1fr auto auto" gap="base" alignItems="center">
        <s-icon type={row.icon} tone="neutral" />
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{row.title}</s-text>
          <s-text color="subdued">{row.status}</s-text>
        </s-stack>
        {row.badge ? <s-badge tone={row.badge.tone}>{row.badge.label}</s-badge> : <s-box />}
        <s-icon type="chevron-right" tone="neutral" size="small" />
      </s-grid>
    </s-clickable>
  );
}

export default function Home() {
  const { steps, required, enabled, businesses, stats, month, lastMonth, months, currency, embedOn, perksPage } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const openSidekick = useSidekick();
  const doneCount = required.filter((s) => s.done).length;
  const allDone = doneCount === required.length;
  const next = steps.find((s) => !s.done && !s.manual);
  const money = (n: number) => formatMoney(n, currency);
  const activeBusinesses = businesses.filter((b) => b.active).length;
  const pausedBusinesses = businesses.length - activeBusinesses;
  const vs = (cur: number, prev: number, fmt?: (n: number) => string) => trend(cur, prev, lastMonth.label, fmt);

  const rows: Row[] = [
    {
      icon: "store",
      title: "Businesses",
      status: businesses.length ? countLine([[activeBusinesses, "active"], [pausedBusinesses, "paused"]]) : "None yet",
      // "Active" only when perks are really being given: program on and at least one business active.
      badge:
        enabled && activeBusinesses > 0
          ? { label: "Active", tone: "success" }
          : { label: "Not active", tone: "warning" },
      href: "/app/businesses",
    },
    {
      icon: "person",
      title: "Employees",
      status: countLine([[stats.active, "active"], [stats.revoked, "removed"]]),
      href: "/app/employees",
    },
    {
      icon: "theme",
      title: "Storefront",
      status: "Employee prices and hidden products",
      badge:
        embedOn === true
          ? { label: "On", tone: "success" }
          : { label: embedOn === false ? "Off" : "Not checked", tone: embedOn === false ? "warning" : "neutral" },
      href: "/app/storefront",
    },
    {
      icon: "page",
      title: "Perks page",
      status: "Public list of companies and discounts",
      badge: perksPage ? { label: "On", tone: "success" } : { label: "Off", tone: "neutral" },
      href: "/app/storefront",
    },
    {
      icon: "chart-vertical",
      title: "Reports",
      status: plural(month.invoices, "invoice") + ` in ${month.label.split(" ")[0]}`,
      href: "/app/reports",
    },
  ];

  return (
    <s-page heading="Employee perks">
      {next ? (
        <s-button slot="primary-action" variant="primary" href={next.action.href}>
          {next.action.label}
        </s-button>
      ) : (
        <s-button slot="primary-action" variant="primary" href="/app/businesses/new">
          Add business
        </s-button>
      )}
      <s-button slot="secondary-actions" href="/app/check">
        Check a customer
      </s-button>
      {openSidekick ? (
        <s-button slot="secondary-actions" onClick={openSidekick}>
          Ask Sidekick
        </s-button>
      ) : null}

      {!allDone ? (
        <s-section heading="Set up employee perks">
          <s-stack gap="base">
            <s-paragraph>
              Give employees of partner companies discounts and products only they can buy. Takes about 3 minutes.
            </s-paragraph>
            <s-stack gap="small-200">
              <s-text color="subdued">
                {doneCount} of {required.length} steps done
              </s-text>
              <s-progress value={doneCount} max={required.length} accessibilityLabel="Setup progress" />
            </s-stack>
            <s-divider />
            {steps.map((step, i) => {
              const isNext = next?.id === step.id;
              return (
                <s-stack key={step.id} direction="inline" gap="base" alignItems="start">
                  <s-icon
                    type={step.done ? "check-circle-filled" : step.manual ? "circle-dashed" : "circle"}
                    tone={step.done ? "success" : "neutral"}
                  />
                  <s-stack gap="small-200" inlineSize="100%">
                    <s-text type="strong">
                      {i + 1}. {step.title}
                      {step.manual ? " (recommended)" : ""}
                    </s-text>
                    {!step.done ? <s-text color="subdued">{step.description}</s-text> : null}
                    {!step.done && (isNext || step.manual) ? (
                      <s-box>
                        <s-button
                          variant={isNext ? "primary" : "secondary"}
                          href={step.action.href}
                          {...(step.action.external ? { target: "_blank" } : {})}
                        >
                          {step.action.label}
                        </s-button>
                      </s-box>
                    ) : null}
                  </s-stack>
                </s-stack>
              );
            })}
          </s-stack>
        </s-section>
      ) : null}

      <s-section accessibilityLabel="Overview">
        <s-stack gap="base">
          <s-grid gridTemplateColumns="1fr minmax(160px, 220px)" gap="base" alignItems="center">
            <s-heading>Overview</s-heading>
            <s-select
              label="Month"
              labelAccessibilityVisibility="exclusive"
              value={month.key}
              onChange={(e) => navigate(`?month=${(e.currentTarget as unknown as { value: string }).value}`)}
            >
              {months.map((m) => (
                <s-option key={m.key} value={m.key}>
                  {m.label}
                </s-option>
              ))}
            </s-select>
          </s-grid>
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
            <Metric
              id="orders"
              label="Orders"
              value={String(month.orders)}
              sub={`/ ${money(month.spend)}`}
              help="Orders placed by employees in the chosen month, and the amount they spent (after their discount). Cancelled orders aren't counted."
              change={vs(month.orders, lastMonth.orders)}
            />
            <Metric
              id="discount"
              label="Discount"
              value={money(month.discount)}
              help="Total employee discount given on the chosen month's orders. This is what you can bill partner companies for in Reports."
              change={vs(month.discount, lastMonth.discount, money)}
            />
            <Metric
              id="employees"
              label="Employees"
              value={String(month.employees)}
              sub={`/ ${month.newEmployees} new`}
              help="All employees who have joined so far, and how many joined in the chosen month."
              change={vs(month.newEmployees, lastMonth.newEmployees)}
            />
            <Metric
              id="businesses"
              label="Businesses"
              value={String(month.businesses)}
              help="Partner companies in the program at the end of the month (deleted ones aren't counted)."
              change={vs(month.businesses, lastMonth.businesses)}
            />
          </s-grid>
        </s-stack>
      </s-section>

      <s-section heading="Manage">
        <s-stack gap="none">
          {rows.map((row, i) => (
            <s-stack key={row.title} gap="none">
              {i > 0 ? <s-divider /> : null}
              <ManageRow row={row} />
            </s-stack>
          ))}
        </s-stack>
      </s-section>

      <s-stack direction="inline" gap="base" justifyContent="center">
        <s-link href="/app/help">How Employee Perks works</s-link>
        <s-link href="/app/audit">Activity log</s-link>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
