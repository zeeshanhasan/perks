import { Suspense, useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Await, useLoaderData, useNavigate, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { formatMoney } from "../lib/business";
import { shopInfo } from "../lib/catalog.server";
import type { Badge, Trend } from "../lib/home";
import { businessesBadge, countLine, monthOptions, plural, storefrontStatus, trend } from "../lib/home";
import type { SetupStep } from "../lib/setup.server";
import { getSetup, themeEditorEmbedUrl } from "../lib/setup.server";
import { embedStatus } from "../lib/storefront.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const month = new URL(request.url).searchParams.get("month");
  // The theme check is the slowest call (~1 s): start it now and stream it in after the page shows.
  const embed = embedStatus(admin).then((e) => e.on);
  const info = await shopInfo(admin, session.shop);
  const setup = await getSetup(session.shop, info.timezone, month);
  return {
    currency: info.currency,
    months: monthOptions(new Date(), 12, info.timezone),
    themeUrl: themeEditorEmbedUrl(session.shop, process.env.SHOPIFY_API_KEY || ""),
    canReadThemes: /\b(read|write)_themes\b/.test(session.scope ?? ""),
    embed,
    ...setup,
  };
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

function Metric({
  id,
  label,
  value,
  sub,
  help,
  change,
  neutral = false,
}: {
  id: string;
  label: string;
  value: string;
  sub?: string;
  help: string;
  change: Trend;
  /** Grey arrows: a change that isn't good or bad in itself (e.g. discount given). */
  neutral?: boolean;
}) {
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
              tone={neutral ? "neutral" : change.dir === "up" ? "success" : "critical"}
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
  badge?: Badge;
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

type Step = Pick<SetupStep, "id" | "title" | "description" | "done" | "manual" | "action"> & { checking?: boolean };

/** Setup checklist. embedOn: undefined while the theme check is still loading. */
function SetupChecklist({ steps, embedOn, themeUrl }: { steps: Step[]; embedOn: boolean | null | undefined; themeUrl: string }) {
  const checking = embedOn === undefined;
  const all: Step[] = [
    ...steps,
    {
      id: "theme",
      title: "Turn on Employee mode in your theme",
      description: checking
        ? "Checking your theme…"
        : "Shows employees their prices and hides employee-only products from other shoppers. One click, then Save.",
      done: embedOn === true,
      manual: embedOn === null,
      checking,
      action: { label: "Turn on Employee mode", href: themeUrl, external: true },
    },
  ];
  const required = all.filter((s) => !s.manual);
  const doneCount = required.filter((s) => s.done).length;
  // While the theme is being checked, don't flash the checklist if everything else is done.
  if (doneCount === required.length || (checking && steps.every((s) => s.done))) return null;
  const next = all.find((s) => !s.done && !s.manual && !s.checking);

  return (
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
        {all.map((step, i) => {
          const isNext = next?.id === step.id;
          return (
            <s-stack key={step.id} direction="inline" gap="base" alignItems="start">
              {step.checking ? (
                <s-spinner size="base" accessibilityLabel="Checking your theme" />
              ) : (
                <s-icon
                  type={step.done ? "check-circle-filled" : step.manual ? "circle-dashed" : "circle"}
                  tone={step.done ? "success" : "neutral"}
                />
              )}
              <s-stack gap="small-200" inlineSize="100%">
                <s-text type="strong">
                  {i + 1}. {step.title}
                  {step.manual ? " (recommended)" : ""}
                </s-text>
                {!step.done ? <s-text color="subdued">{step.description}</s-text> : null}
                {!step.done && !step.checking && (isNext || step.manual) ? (
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
  );
}

export default function Home() {
  const { steps, enabled, businesses, stats, month, lastMonth, months, currency, perksPage, embed, themeUrl, canReadThemes } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const changingMonth = navigation.state === "loading" && navigation.location.pathname === "/app";
  const openSidekick = useSidekick();
  const money = (n: number) => formatMoney(n, currency);
  const activeBusinesses = businesses.filter((b) => b.active).length;
  const pausedBusinesses = businesses.length - activeBusinesses;
  const vs = (cur: number, prev: number, fmt?: (n: number) => string) => trend(cur, prev, lastMonth.label, fmt);
  const monthName = month.label.split(" ")[0];
  const nextServerStep = steps.find((s) => !s.done);

  const storefrontRow = (on: boolean | null | undefined): Row => {
    const s =
      on === undefined
        ? { status: "Checking your theme…", badge: { label: "Checking", tone: "neutral" as const } }
        : storefrontStatus(on, canReadThemes);
    return { icon: "theme", title: "Storefront", ...s, href: "/app/storefront" };
  };
  const rowsBefore: Row[] = [
    {
      icon: "store",
      title: "Businesses",
      status: businesses.length ? countLine([[activeBusinesses, "active"], [pausedBusinesses, "paused"]]) : "None yet",
      badge: businessesBadge(enabled, activeBusinesses),
      href: "/app/businesses",
    },
    {
      icon: "person",
      title: "Employees",
      status: countLine([[stats.active, "active"], [stats.revoked, "removed"]]),
      href: "/app/employees",
    },
  ];
  const rowsAfter: Row[] = [
    {
      icon: "page",
      title: "Perks page",
      status: "Public list of companies and discounts",
      badge: perksPage ? { label: "On", tone: "success" } : { label: "Off", tone: "neutral" },
      href: "/app/storefront?section=perks-page",
    },
    {
      icon: "chart-vertical",
      title: "Reports",
      status: plural(month.invoices, "invoice") + ` in ${monthName}`,
      href: "/app/reports",
    },
  ];

  return (
    <s-page heading="Employee perks">
      {nextServerStep ? (
        <s-button slot="primary-action" variant="primary" href={nextServerStep.action.href}>
          {nextServerStep.action.label}
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

      <Suspense fallback={<SetupChecklist steps={steps} embedOn={undefined} themeUrl={themeUrl} />}>
        <Await resolve={embed} errorElement={<SetupChecklist steps={steps} embedOn={null} themeUrl={themeUrl} />}>
          {(on) => <SetupChecklist steps={steps} embedOn={on} themeUrl={themeUrl} />}
        </Await>
      </Suspense>

      <s-section accessibilityLabel="Overview">
        <s-stack gap="base">
          <s-grid gridTemplateColumns="1fr auto minmax(160px, 220px)" gap="base" alignItems="center">
            <s-heading>Overview</s-heading>
            {changingMonth ? <s-spinner size="base" accessibilityLabel="Loading month" /> : <s-box />}
            <s-select
              label="Month"
              labelAccessibilityVisibility="exclusive"
              value={month.key}
              disabled={changingMonth}
              onChange={(e) => navigate(`?month=${(e.currentTarget as unknown as { value: string }).value}`)}
            >
              {months.map((m) => (
                <s-option key={m.key} value={m.key}>
                  {m.label}
                </s-option>
              ))}
            </s-select>
          </s-grid>
          <div style={{ opacity: changingMonth ? 0.5 : 1, transition: "opacity 150ms" }}>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
              <Metric
                id="spend"
                label="Employee spend"
                value={money(month.spend)}
                sub={plural(month.orders, "order")}
                help="What employees spent in the chosen month (after their discount), and how many orders. Cancelled orders aren't counted."
                change={vs(month.spend, lastMonth.spend, money)}
              />
              <Metric
                id="discount"
                label="Discount given"
                value={money(month.discount)}
                help="Total employee discount given on the chosen month's orders. This is what you can bill partner companies for in Reports."
                change={vs(month.discount, lastMonth.discount, money)}
                neutral
              />
              <Metric
                id="employees"
                label="Active employees"
                value={String(month.employees)}
                sub={`${month.newEmployees} joined`}
                help="Employees who can get perks now and had joined by the end of the chosen month, and how many joined in it. Removed employees aren't counted."
                change={vs(month.employees, lastMonth.employees)}
              />
              <Metric
                id="businesses"
                label="Active businesses"
                value={String(month.businesses)}
                help="Partner companies giving perks now that were added by the end of the chosen month. Paused and deleted ones aren't counted."
                change={vs(month.businesses, lastMonth.businesses)}
              />
            </s-grid>
          </div>
        </s-stack>
      </s-section>

      <s-section heading="Manage">
        <s-stack gap="none">
          {rowsBefore.map((row, i) => (
            <s-stack key={row.title} gap="none">
              {i > 0 ? <s-divider /> : null}
              <ManageRow row={row} />
            </s-stack>
          ))}
          <s-divider />
          <Suspense fallback={<ManageRow row={storefrontRow(undefined)} />}>
            <Await resolve={embed} errorElement={<ManageRow row={storefrontRow(null)} />}>
              {(on) => <ManageRow row={storefrontRow(on)} />}
            </Await>
          </Suspense>
          {rowsAfter.map((row) => (
            <s-stack key={row.title} gap="none">
              <s-divider />
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

export function ErrorBoundary() {
  return <RouteError heading="Employee perks" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
