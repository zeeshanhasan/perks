import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { sweepExpired } from "../lib/membership.server";
import { parseJsonList } from "../lib/policy";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const [employer, policy, active, total] = await Promise.all([
    db.employer.findUnique({ where: { shop } }),
    db.benefitPolicy.findUnique({ where: { shop } }),
    db.employeeMembership.count({ where: { shop, status: "active" } }),
    db.employeeMembership.count({ where: { shop } }),
  ]);
  const domains = parseJsonList(employer?.domains);
  const employeeOnly = parseJsonList(policy?.employeeOnlyProducts).length;
  return {
    shop,
    stats: { active, total },
    checklist: {
      settings: Boolean(employer?.name && domains.length),
      products: employeeOnly > 0,
      discount: Boolean(policy?.discountId),
      validation: Boolean(policy?.validationId),
      enabled: Boolean(policy?.enabled),
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const result = await sweepExpired(admin, session.shop);
  return { swept: result };
};

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <s-list-item>
      {done ? "✅ " : "⬜️ "}
      {children}
    </s-list-item>
  );
}

export default function Index() {
  const { shop, stats, checklist } = useLoaderData<typeof loader>();
  const sweep = useFetcher<typeof action>();
  const storeHandle = shop.replace(".myshopify.com", "");

  return (
    <s-page heading="Tofo Perks">
      <s-section heading="Setup">
        <s-unordered-list>
          <Check done={checklist.settings}>
            <s-link href="/app/settings">Set the employer and approved email domains</s-link>
          </Check>
          <Check done={checklist.products}>
            <s-link href="/app/products">Pick employee-only products</s-link>
          </Check>
          <Check done={checklist.discount}>Employee discount created (saved from Settings)</Check>
          <Check done={checklist.validation}>Checkout protection active (needs employee-only products)</Check>
          <Check done={checklist.enabled}>Program switched on</Check>
          <s-list-item>
            Add the <strong>Perks</strong> blocks to your theme:{" "}
            <s-link href={`https://admin.shopify.com/store/${storeHandle}/themes/current/editor`} target="_blank">
              open theme editor
            </s-link>
          </s-list-item>
          <s-list-item>
            Link customers to <code>/apps/perks/verify</code> on your storefront
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Employees">
        <s-paragraph>
          {stats.active} active of {stats.total} total.{" "}
          <s-link href="/app/employees">Manage employees</s-link>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Maintenance">
        <s-paragraph>Expired memberships are cleared automatically. You can also run it now.</s-paragraph>
        <s-button
          onClick={() => sweep.submit({}, { method: "post" })}
          {...(sweep.state !== "idle" ? { loading: true } : {})}
        >
          Run expiry check now
        </s-button>
        {sweep.data?.swept ? (
          <s-paragraph>
            Checked {sweep.data.swept.checked}, expired {sweep.data.swept.expired}.
          </s-paragraph>
        ) : null}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
