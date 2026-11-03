import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { PageHelp } from "../components/ui";
import { describeDiscount, describeLimit } from "../lib/business";
import { listBusinesses } from "../lib/business.server";
import { shopCurrency } from "../lib/catalog.server";
import { describeTarget } from "../lib/targeting";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [businesses, counts, { currency }] = await Promise.all([
    listBusinesses(session.shop),
    db.employeeMembership.groupBy({ by: ["businessId"], where: { shop: session.shop, status: "active" }, _count: true }),
    shopCurrency(admin),
  ]);
  const active = new Map(counts.map((c) => [c.businessId, c._count]));
  return {
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      domains: b.domains.join(", "),
      discount: describeDiscount(b, currency),
      applies: describeTarget(b.discountTarget, "Employee-only products only"),
      employeeOnly: describeTarget(b.employeeOnlyTarget, "None"),
      limit: describeLimit(b, currency),
      employees: active.get(b.id) ?? 0,
      active: b.active,
    })),
  };
};

export default function Businesses() {
  const { businesses } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Businesses">
      <s-button slot="primary-action" variant="primary" href="/app/businesses/new">
        Add business
      </s-button>
      <s-stack gap="base">
        <PageHelp title="Partner businesses">
          Each business has its own email domains, discount, products and limits. Employees are matched to a
          business by their work email domain.
        </PageHelp>
        {businesses.length ? (
          <s-section padding="none">
            <s-table>
              <s-table-header-row>
                <s-table-header>Business</s-table-header>
                <s-table-header>Discount</s-table-header>
                <s-table-header>Applies to</s-table-header>
                <s-table-header>Employee-only</s-table-header>
                <s-table-header>Limit</s-table-header>
                <s-table-header>Employees</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {businesses.map((b) => (
                  <s-table-row key={b.id}>
                    <s-table-cell>
                      <s-stack gap="small-300">
                        <s-link href={`/app/businesses/${b.id}`}>{b.name}</s-link>
                        <s-text color="subdued">{b.domains}</s-text>
                        {!b.active ? <s-badge>Paused</s-badge> : null}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>{b.discount}</s-table-cell>
                    <s-table-cell>{b.applies}</s-table-cell>
                    <s-table-cell>{b.employeeOnly}</s-table-cell>
                    <s-table-cell>{b.limit}</s-table-cell>
                    <s-table-cell>{String(b.employees)}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-section>
        ) : (
          <s-section>
            <s-empty-state heading="Add your first partner business">
              <s-paragraph>
                Add a company, its email domains and the discount its employees get. You can add as many businesses as
                you like, each with different discounts and products.
              </s-paragraph>
              <s-button slot="primary-action" variant="primary" href="/app/businesses/new">
                Add business
              </s-button>
            </s-empty-state>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
