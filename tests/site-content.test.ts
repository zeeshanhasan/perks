/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { FAQ, SITE_DESCRIPTION, SITE_TITLE, landingJsonLd, landingMeta } from "../app/lib/site-content";

const SITE = "https://perks.tofoapp.com";

describe("landing page SEO", () => {
  it("has a title and description within search snippet lengths", () => {
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(220);
  });

  it("sets Open Graph and Twitter large image tags", () => {
    const meta = landingMeta(SITE) as unknown as Record<string, string>[];
    const get = (k: string) => meta.find((m) => m.property === k || m.name === k)?.content;
    expect(get("og:image")).toBe(`${SITE}/site/og.jpg`);
    expect(get("og:image:width")).toBe("1200");
    expect(get("twitter:card")).toBe("summary_large_image");
    expect(meta.some((m) => m.rel === "canonical" && m.href === `${SITE}/`)).toBe(true);
  });

  it("publishes the app, its two plans and every FAQ as structured data", () => {
    const [app, faq] = landingJsonLd(SITE) as any[];
    expect(app["@type"]).toBe("SoftwareApplication");
    expect(app.offers.map((o: any) => o.price)).toEqual(["9.00", "19.00"]);
    expect(faq.mainEntity).toHaveLength(FAQ.length);
    expect(JSON.stringify(landingJsonLd(SITE))).not.toMatch(/founding|first 50/i);
  });

  it("FAQ has no duplicate questions", () => {
    expect(new Set(FAQ.map(([q]) => q)).size).toBe(FAQ.length);
  });
});
