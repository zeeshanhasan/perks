import { formatMoney } from "../lib/business";

// Pieces shared by the Edit business page and the Add business wizard, so both read the same.

/** Polaris text ignores weight/tone inside these cards, so a plain box in Polaris' success colours. */
export function GreenNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#cdfee1",
        color: "#0c5132",
        fontWeight: 600,
        fontSize: 13,
        lineHeight: "20px",
        padding: "6px 12px",
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}

const val = (e: Event) => (e.currentTarget as unknown as { value: string }).value;

export function discountSentence(discountType: string, discountValue: string, currency: string) {
  return discountType === "fixed"
    ? `Employees get ${formatMoney(Number(discountValue) || 0, currency)} off every unit of a discounted product, never more than its price.`
    : `Employees get ${Number(discountValue) || 0}% off the price of every discounted product.`;
}

export function DiscountFields({
  discountType,
  discountValue,
  currency,
  error,
  onChange,
}: {
  discountType: string;
  discountValue: string;
  currency: string;
  error?: string;
  onChange: (patch: { discountType?: string; discountValue?: string }) => void;
}) {
  const fixed = discountType === "fixed";
  return (
    <s-stack gap="base">
      <s-grid gridTemplateColumns="@container (inline-size > 600px) 1fr 1fr, 1fr" gap="base">
        <s-select label="Type" value={discountType} onChange={(e) => onChange({ discountType: val(e) })}>
          <s-option value="percentage">Percentage off each item</s-option>
          <s-option value="fixed">Fixed amount off each item</s-option>
        </s-select>
        <s-number-field
          label={fixed ? `Amount (${currency})` : "Percentage"}
          value={discountValue}
          onInput={(e) => onChange({ discountValue: val(e) })}
          min={fixed ? 0 : 1}
          max={fixed ? 1000000 : 90}
          step={fixed ? 0.01 : 1}
          suffix={fixed ? undefined : "%"}
          error={error}
        />
      </s-grid>
      <GreenNote>{discountSentence(discountType, discountValue, currency)}</GreenNote>
    </s-stack>
  );
}

export type LimitValues = { limitPeriod: string; limitBasis: string; limitAmount: string; limitOverflow: string };

export function limitSentence(v: LimitValues, currency: string) {
  if (v.limitPeriod === "none") return "";
  const amount = formatMoney(Number(v.limitAmount) || 0, currency);
  const restart = v.limitPeriod === "month" ? " on the 1st" : " on 1 January";
  return v.limitBasis === "spend"
    ? `The discount applies to the first ${amount} each employee spends every ${v.limitPeriod}. After that, full price until the next ${v.limitPeriod} starts${restart}.`
    : `Each employee gets up to ${amount} of discount every ${v.limitPeriod}. After that, full price until the next ${v.limitPeriod} starts${restart}.`;
}

export function LimitFields({
  value,
  currency,
  error,
  onChange,
}: {
  value: LimitValues;
  currency: string;
  error?: string;
  onChange: (patch: Partial<LimitValues>) => void;
}) {
  const m = (n: number) => formatMoney(n, currency);
  return (
    <s-stack gap="base">
      <s-select label="Limit per employee" value={value.limitPeriod} onChange={(e) => onChange({ limitPeriod: val(e) })}>
        <s-option value="none">No limit</s-option>
        <s-option value="month">Every month (starts again on the 1st)</s-option>
        <s-option value="year">Every year (starts again on 1 January)</s-option>
      </s-select>
      {value.limitPeriod !== "none" ? (
        <>
          <s-grid gridTemplateColumns="@container (inline-size > 600px) 1fr 1fr, 1fr" gap="base">
            <s-select label="Limit on" value={value.limitBasis} onChange={(e) => onChange({ limitBasis: val(e) })}>
              <s-option value="discount">Discount received</s-option>
              <s-option value="spend">Total spend</s-option>
            </s-select>
            <s-number-field
              label={`Amount (${currency})`}
              value={value.limitAmount}
              onInput={(e) => onChange({ limitAmount: val(e) })}
              min={0}
              step={0.01}
              error={error}
            />
          </s-grid>
          <s-checkbox
            label="Use up what's left of the limit"
            details={
              value.limitBasis === "spend"
                ? `Example: an employee has ${m(100)} of discounted spend left and buys a ${m(300)} item. Ticked: the first ${m(100)} of it is discounted. Unticked: that item is full price.`
                : `Example: an employee has ${m(100)} of discount left and the next item would get ${m(300)} off. Ticked: it gets ${m(100)} off. Unticked: that item is full price.`
            }
            checked={value.limitOverflow !== "whole"}
            onChange={(e) =>
              onChange({ limitOverflow: (e.currentTarget as unknown as { checked: boolean }).checked ? "partial" : "whole" })
            }
          />
          <GreenNote>{limitSentence(value, currency)}</GreenNote>
        </>
      ) : (
        <s-text color="subdued">Optional. Cap how much each employee gets per month or per year.</s-text>
      )}
    </s-stack>
  );
}

export const DISCOUNTED_PRODUCTS_NOTE =
  "Anyone can buy these at the normal price; this business's employees get the discount. Employee-only products are always discounted too.";

export function EmployeeOnlyHelp() {
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack gap="small-200">
        <s-text type="strong">How employee-only products work</s-text>
        <s-unordered-list>
          <s-list-item>
            <strong>At checkout, always:</strong> anyone who isn&apos;t this business&apos;s employee can&apos;t check out
            with them. They see a message asking them to log in with their work email or remove the items. This works even
            if your theme isn&apos;t set up.
          </s-list-item>
          <s-list-item>
            <strong>In your store, with Employee mode on:</strong> they&apos;re hidden from collections and search for
            everyone else, and their product page shows a message instead of the buy button. Someone with a direct link can
            still see the page, but can&apos;t buy. Turn on Employee mode on the{" "}
            <s-link href="/app/storefront">Storefront</s-link> page.
          </s-list-item>
          <s-list-item>
            <strong>For this business&apos;s employees:</strong> they see and buy them like any product, with their
            discount.
          </s-list-item>
        </s-unordered-list>
      </s-stack>
    </s-box>
  );
}
