import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// "Employee perks" card on the Shopify customer page: which business, what discount, limit used and left.
// Data comes from the app (GET /api/customer-perks/:id); fetch adds the Shopify ID token automatically.

type Perks = {
  eligible: boolean;
  reason: { title: string; detail: string | null } | null;
  business: { name: string; discount: string; appliesTo: string; employeeOnly: string } | null;
  joinedBy: string | null;
  since: string | null;
  expires: string | null;
  limit: {
    period: string;
    basis: string;
    percent: number;
    usedText: string;
    leftText: string;
    limitText: string;
  } | null;
  savedTotal: string;
  orders: number;
};

export default async () => {
  render(<Extension />, document.body);
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <s-stack direction="inline" justifyContent="space-between" gap="base">
      <s-text color="subdued">{label}</s-text>
      <s-text>{value}</s-text>
    </s-stack>
  );
}

function Extension() {
  const id = shopify.data.selected?.[0]?.id ?? "";
  const [state, setState] = useState<{ loading: boolean; data: Perks | null; error: string | null }>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    let live = true;
    const customerId = String(id).split("/").pop();
    fetch(`/api/customer-perks/${customerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => live && setState({ loading: false, data, error: null }))
      .catch(() => live && setState({ loading: false, data: null, error: "Couldn't load employee perks." }));
    return () => {
      live = false;
    };
  }, [id]);

  const { loading, data, error } = state;
  const summary = loading ? "Loading" : error ? "Unavailable" : data?.eligible && data.business ? `${data.business.name} · ${data.business.discount}` : "No perks";

  return (
    <s-admin-block heading="Employee perks" collapsedSummary={summary}>
      {loading ? (
        <s-stack direction="inline" justifyContent="center">
          <s-spinner accessibilityLabel="Loading employee perks" />
        </s-stack>
      ) : error || !data ? (
        <s-banner tone="critical">{error ?? "Couldn't load employee perks."}</s-banner>
      ) : (
        <s-stack gap="small-200">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-badge tone={data.eligible ? "success" : "neutral"}>{data.eligible ? "Gets perks" : "No perks"}</s-badge>
            {data.business ? (
              <s-text type="strong">
                {data.business.name} · {data.business.discount}
              </s-text>
            ) : null}
          </s-stack>

          {!data.eligible && data.reason ? (
            <s-text color="subdued">
              {data.reason.title}
              {data.reason.detail ? `. ${data.reason.detail}` : ""}
            </s-text>
          ) : null}

          {data.business ? (
            <s-text color="subdued">
              {data.business.appliesTo}
              {data.business.employeeOnly !== "None" ? ` · Employee-only: ${data.business.employeeOnly}` : ""}
              {data.joinedBy ? ` · ${data.joinedBy}` : ""}
              {data.since ? ` since ${data.since}` : ""}
              {data.expires ? `, expires ${data.expires}` : ""}
            </s-text>
          ) : null}

          {data.business ? (
            <Row
              label={data.limit ? `Limit this ${data.limit.period}` : "Limit"}
              value={
                data.limit
                  ? `${data.limit.usedText} of ${data.limit.limitText} ${data.limit.basis} used · ${data.limit.leftText} left`
                  : "No limit"
              }
            />
          ) : null}
          <Row label="Orders with perks" value={`${data.orders} · ${data.savedTotal} saved`} />
          <s-link href={`app:app/employees?q=${String(id).split("/").pop()}`}>Manage in Employee Perks</s-link>
        </s-stack>
      )}
    </s-admin-block>
  );
}
