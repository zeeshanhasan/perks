// Cloudflare Worker for perks.tofoapp.com/* only (decision 004: never the *.tofoapp.com wildcard).
// Passes every request through to Railway unchanged. When Railway can't be reached or answers 502/503/504,
// it shows a short branded page instead of Cloudflare's error page. Nothing is cached or stored.

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Employee Perks is briefly unavailable</title>
<meta http-equiv="refresh" content="30"></head>
<body style="margin:0;font:16px/1.6 system-ui,-apple-system,sans-serif;color:#1f2a44;background:#fff">
<main style="max-width:560px;margin:80px auto;padding:0 20px">
<h1 style="font-size:24px;margin:0 0 8px">Employee Perks is briefly unavailable</h1>
<p style="margin:0 0 12px;color:#5b6478">We're back in a moment. This page refreshes by itself.</p>
<p style="margin:0;color:#5b6478">Employee discounts and employee-only products keep working at checkout in the meantime.</p>
</main></body></html>`;

export default {
  async fetch(request) {
    try {
      const res = await fetch(request);
      if (res.status !== 502 && res.status !== 503 && res.status !== 504) return res;
    } catch {
      // Origin unreachable: fall through to the page below.
    }
    // Health checks and webhooks keep a plain status so monitors and Shopify retries still work.
    const path = new URL(request.url).pathname;
    if (path === "/healthz" || path.startsWith("/webhooks")) return new Response("unavailable", { status: 503 });
    return new Response(PAGE, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "30", "cache-control": "no-store" } });
  },
};
