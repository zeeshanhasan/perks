import type { MetaFunction } from "react-router";
import { AI_GUIDE } from "../lib/ai-help";

// Public: GET /ai-guide — the same guide as /llms.txt, readable in a browser.
export const meta: MetaFunction = () => [{ title: "Employee Perks: guide for AI assistants" }];

const page = {
  maxWidth: 760,
  margin: "48px auto",
  padding: "0 20px",
  font: "15px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#1a1a1a",
  whiteSpace: "pre-wrap",
} as const;

export default function AiGuide() {
  return <main style={page}>{AI_GUIDE}</main>;
}
