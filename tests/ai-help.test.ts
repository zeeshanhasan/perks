import { describe, expect, it } from "vitest";
import { AI_GUIDE, aiChatUrl, aiPrompt, guideUrl } from "../app/lib/ai-help";

describe("AI help links", () => {
  it("points the guide at the app's own host", () => {
    expect(guideUrl("https://perks.tofoapp.com/")).toBe("https://perks.tofoapp.com/llms.txt");
    expect(guideUrl("")).toBe("https://perks.tofoapp.com/llms.txt");
  });

  it("builds each assistant's new-chat link with the prompt encoded", () => {
    const prompt = aiPrompt("https://perks.tofoapp.com/llms.txt");
    const q = encodeURIComponent(prompt);
    expect(aiChatUrl("claude", prompt)).toBe(`https://claude.ai/new?q=${q}`);
    expect(aiChatUrl("chatgpt", prompt)).toBe(`https://chatgpt.com/?q=${q}`);
    expect(aiChatUrl("gemini", prompt)).toBe(`https://gemini.google.com/app?q=${q}`);
    expect(new URL(aiChatUrl("claude", prompt)).searchParams.get("q")).toBe(prompt);
  });

  it("keeps the prompt short enough for prefill links", () => {
    expect(aiPrompt("https://perks.tofoapp.com/llms.txt").length).toBeLessThan(200);
  });

  it("guide has no store-specific details", () => {
    expect(AI_GUIDE).not.toMatch(/myshopify\.com|perks-frtekwck/);
  });
});
