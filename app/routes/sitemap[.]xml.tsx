import { SITE_URL } from "../components/PublicLayout";
import { sitemapXml } from "../lib/seo";

// Public: GET /sitemap.xml: the landing, privacy and terms pages.
export const loader = () =>
  new Response(sitemapXml(SITE_URL, "2026-11-16"), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, no-transform" },
  });
