import { describe, expect, it } from "vitest";
import { robotsTxt, sitemapXml } from "../app/lib/seo";

describe("SEO files", () => {
  it("opens only the production site to search engines, never the app or webhooks", () => {
    const prod = robotsTxt("perks.tofoapp.com", "https://perks.tofoapp.com");
    expect(prod).toContain("Allow: /");
    expect(prod).toContain("Disallow: /app");
    expect(prod).toContain("Disallow: /webhooks");
    expect(prod).toContain("Sitemap: https://perks.tofoapp.com/sitemap.xml");
    expect(robotsTxt("dev-perks.tofoapp.com", "https://perks.tofoapp.com")).toBe("User-agent: *\nDisallow: /\n");
  });

  it("lists the public pages", () => {
    const xml = sitemapXml("https://perks.tofoapp.com", "2026-11-16");
    for (const p of ["https://perks.tofoapp.com/<", "/privacy<", "/terms<"]) expect(xml).toContain(p);
    expect(xml).not.toContain("/app");
  });
});
