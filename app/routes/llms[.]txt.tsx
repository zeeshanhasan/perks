import { AI_GUIDE } from "../lib/ai-help";

// Public: GET /llms.txt — the guide that the "Ask Claude / ChatGPT / Gemini" links on Home point to.
export const loader = () =>
  new Response(AI_GUIDE, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, no-transform",
    },
  });
