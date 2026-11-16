import type { LoaderFunctionArgs } from "react-router";
import { SITE_URL } from "../components/PublicLayout";
import { robotsTxt } from "../lib/seo";

// Public: GET /robots.txt. The dev tunnel and any other host are closed to search engines.
export const loader = ({ request }: LoaderFunctionArgs) =>
  new Response(robotsTxt(new URL(request.url).hostname, SITE_URL), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, no-transform" },
  });
