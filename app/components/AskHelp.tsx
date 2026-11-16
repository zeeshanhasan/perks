import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { AiLogo, SidekickLogo } from "./AiLogos";
import type { AiAssistant } from "../lib/ai-help";
import { AI_ASSISTANTS, SIDEKICK_PROMPT, aiChatUrl } from "../lib/ai-help";

// "Ask Sidekick / Claude / ChatGPT / Gemini" rows, shared by Home's Help section and the Help page.

/** App Bridge's Sidekick Launch API. Not in our installed types yet; App Bridge itself loads from Shopify's CDN. */
type SidekickApi = {
  isEnabled: () => Promise<boolean>;
  launch?: (args: { message: string }) => Promise<unknown>;
  open?: () => Promise<unknown>;
};

/** Opens Sidekick with our prompt (launch), or empty on older App Bridge (open). null when Sidekick is off for the store. */
export function useSidekick() {
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
  if (!enabled) return null;
  return () => {
    const sk = shopify.sidekick;
    const opened = sk?.launch ? sk.launch({ message: SIDEKICK_PROMPT }) : sk?.open?.();
    void opened?.catch(() => {});
  };
}

export type HelpRowProps = {
  logo: React.ReactNode;
  title: string;
  /** Second line of text; hidden in compact rows. */
  status?: string;
  external?: boolean;
  onClick: () => void;
};

export function HelpRow({ logo, title, status, external, onClick }: HelpRowProps) {
  return (
    <s-clickable onClick={onClick} paddingBlock="small" paddingInline="small-100" borderRadius="base" accessibilityLabel={title}>
      <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
        {logo}
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{title}</s-text>
          {status ? <s-text color="subdued">{status}</s-text> : null}
        </s-stack>
        <s-icon type={external ? "external" : "chevron-right"} tone="neutral" size="small" />
      </s-grid>
    </s-clickable>
  );
}

/** Rows separated by dividers. */
export function HelpRows({ rows }: { rows: HelpRowProps[] }) {
  return (
    <s-stack gap="none">
      {rows.map((row, i) => (
        <s-stack key={row.title} gap="none">
          {i > 0 ? <s-divider /> : null}
          <HelpRow {...row} />
        </s-stack>
      ))}
    </s-stack>
  );
}

/** Sidekick (when on) and the outside assistants, each opening a chat that knows this app. */
export function askRows(prompt: string, openSidekick: (() => void) | null, compact = false): HelpRowProps[] {
  const openChat = (id: AiAssistant) => window.open(aiChatUrl(id, prompt), "_blank", "noopener,noreferrer");
  return [
    ...(openSidekick
      ? [{ logo: <SidekickLogo />, title: "Ask Sidekick", status: compact ? undefined : "Shopify's assistant, right here", onClick: openSidekick }]
      : []),
    ...AI_ASSISTANTS.map(({ id, name }) => ({
      logo: <AiLogo assistant={id} />,
      title: `Ask ${name}`,
      status: compact ? undefined : "Opens a new chat that knows this app",
      external: true,
      onClick: () => openChat(id),
    })),
  ];
}
