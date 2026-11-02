import type { ReactNode } from "react";

/** "How this works" explainer shown at the top of each page. */
export function PageHelp({ title, children }: { title: string; children: ReactNode }) {
  return (
    <s-banner tone="info" heading={title} dismissible>
      {children}
    </s-banner>
  );
}

export function Stat({ label, value, help }: { label: string; value: number | string; help?: string }) {
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{String(value)}</s-heading>
        {help ? <s-text color="subdued">{help}</s-text> : null}
      </s-stack>
    </s-box>
  );
}

/** Small label + value row used in summary cards. */
export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <s-stack direction="inline" gap="small" alignItems="center" justifyContent="space-between">
      <s-text color="subdued">{label}</s-text>
      <s-text>{children}</s-text>
    </s-stack>
  );
}
