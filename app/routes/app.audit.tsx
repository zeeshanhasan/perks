import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const events = await db.auditEvent.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return {
    events: events.map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString().replace("T", " ").slice(0, 19),
      actor: e.actor,
      action: e.action,
      subject: e.subject ?? "",
      result: e.result,
      detail: e.detail ?? "",
    })),
  };
};

const TONE: Record<string, "success" | "critical" | "warning"> = { ok: "success", error: "critical", rejected: "warning" };

export default function Audit() {
  const { events } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Audit log">
      <s-section padding="none">
        {events.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header>Time (UTC)</s-table-header>
              <s-table-header>Actor</s-table-header>
              <s-table-header>Action</s-table-header>
              <s-table-header>Subject</s-table-header>
              <s-table-header>Result</s-table-header>
              <s-table-header>Detail</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {events.map((e) => (
                <s-table-row key={e.id}>
                  <s-table-cell>{e.at}</s-table-cell>
                  <s-table-cell>{e.actor}</s-table-cell>
                  <s-table-cell>{e.action}</s-table-cell>
                  <s-table-cell>{e.subject}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={TONE[e.result]}>{e.result}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{e.detail}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="base">
            <s-paragraph>No events yet.</s-paragraph>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
