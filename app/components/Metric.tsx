import type { Trend } from "../lib/home";

/** Number card used on Home and Reports: label with a tooltip, the value, and ↑/↓ against the period before. */
export function Metric({
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
