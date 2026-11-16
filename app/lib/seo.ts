// robots.txt and sitemap.xml for the public site. Only the production address is open to search engines.

export const PUBLIC_PAGES = ["/", "/privacy", "/terms"] as const;
const PRODUCTION_HOST = "perks.tofoapp.com";

export function robotsTxt(host: string, siteUrl: string): string {
  if (host !== PRODUCTION_HOST) return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /app",
    "Disallow: /auth",
    "Disallow: /api",
    "Disallow: /webhooks",
    "Disallow: /proxy",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml(siteUrl: string, lastmod: string): string {
  const urls = PUBLIC_PAGES.map(
    (p) => `  <url><loc>${siteUrl}${p === "/" ? "/" : p}</loc><lastmod>${lastmod}</lastmod></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
