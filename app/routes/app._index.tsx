import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { KeyValue, Stat } from "../components/ui";
import { getSetup } from "../lib/setup.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const setup = await getSetup(session.shop, process.env.SHOPIFY_API_KEY || "");
  return { shop: session.shop, ...setup };
};

export default function Home() {
  const { steps, required, program, stats } = useLoaderData<typeof loader>();
  const doneCount = required.filter((s) => s.done).length;
  const allDone = doneCount === required.length;
  const next = steps.find((s) => !s.done && !s.manual);

  return (
    <s-page heading="Employee perks">
      {next ? (
        <s-button slot="primary-action" variant="primary" href={next.action.href}>
          {next.action.label}
        </s-button>
      ) : null}

      {!allDone ? (
        <s-section heading="Set up employee perks">
          <s-stack gap="base">
            <s-paragraph>
              Give employees of a partner company a discount and access to products only they can buy. Takes about 3
              minutes.
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
          Employees who log in with an approved work email get {program.percent}% off automatically.
        </s-banner>
      )}

      <s-section heading="Employees">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <Stat label="Active employees" value={stats.active} />
          <Stat label="Joined by work-email login" value={stats.viaDomain} />
          <Stat label="Verified by email link" value={stats.viaLink} />
          <Stat label="Removed" value={stats.revoked} />
        </s-grid>
        <s-box paddingBlockStart="base">
          <s-link href="/app/employees">View all employees</s-link>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Program">
        <s-stack gap="small">
          <KeyValue label="Status">
            <s-badge tone={program.enabled ? "success" : "neutral"}>{program.enabled ? "On" : "Off"}</s-badge>
          </KeyValue>
          <KeyValue label="Company">{program.employerName || "Not set"}</KeyValue>
          <KeyValue label="Email domains">{program.domains.length ? program.domains.join(", ") : "Not set"}</KeyValue>
          <KeyValue label="Discount">{program.percent}%</KeyValue>
          <KeyValue label="Applies to">
            {program.allProducts ? "All products" : `${program.employeeOnly + program.discounted} products`}
          </KeyValue>
          <KeyValue label="Employee-only products">{program.employeeOnly}</KeyValue>
          <s-link href="/app/settings">Edit settings</s-link>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Need help?">
        <s-stack gap="small">
          <s-paragraph>Learn how employees get perks, and what to do when something doesn&apos;t work.</s-paragraph>
          <s-link href="/app/help">Read the guide</s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
