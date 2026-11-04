import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Stat } from "../components/ui";
import { formatMoney } from "../lib/business";
import { shopCurrency } from "../lib/catalog.server";
import { getSetup } from "../lib/setup.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { currency } = await shopCurrency(admin);
  const setup = await getSetup(session.shop, process.env.SHOPIFY_API_KEY || "", currency);
  return { currency, ...setup };
};

export default function Home() {
  const { steps, required, enabled, businesses, stats, month, currency } = useLoaderData<typeof loader>();
  const doneCount = required.filter((s) => s.done).length;
  const allDone = doneCount === required.length;
  const next = steps.find((s) => !s.done && !s.manual);
  const money = (n: number) => formatMoney(n, currency);

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
      ) : (
        <s-banner tone="success" heading="Employee perks are live">
          Employees of {businesses.length} business{businesses.length === 1 ? "" : "es"} get their perks automatically
          when they log in with a work email.
        </s-banner>
      )}

      <s-section heading="This month">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <Stat label="Employee orders" value={month.orders} />
          <Stat label="Employee spend" value={money(month.spend)} />
          <Stat label="Discount given" value={money(month.discount)} />
          <Stat label="Active employees" value={stats.active} />
        </s-grid>
        <s-box paddingBlockStart="base">
          <s-link href="/app/reports">Reports and invoices</s-link>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Businesses">
        <s-stack gap="small">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-text color="subdued">Program</s-text>
            <s-badge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</s-badge>
          </s-stack>
          {businesses.length ? (
            businesses.map((b) => (
              <s-stack key={b.id} gap="small-300">
                <s-link href={`/app/businesses/${b.id}`}>{b.name}</s-link>
                <s-text color="subdued">
                  {b.discount} · {b.domains}
                  {!b.active ? " · paused" : ""}
                </s-text>
              </s-stack>
            ))
          ) : (
            <s-text color="subdued">None yet.</s-text>
          )}
          <s-link href="/app/businesses">Manage businesses</s-link>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Need help?">
        <s-stack gap="small">
          <s-paragraph>Someone says they don&apos;t get the discount? Check them in seconds.</s-paragraph>
          <s-link href="/app/check">Check a customer</s-link>
          <s-link href="/app/help">How Employee Perks works</s-link>
          <s-link href="/app/audit">Activity log</s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
