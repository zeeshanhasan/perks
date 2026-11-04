import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";

/**
 * Catch-all for unknown URLs. Shopify can open stale paths after an app update or a permission
 * approval. When the request carries Shopify's embedded params, send it to the app home instead of
 * a dead end. Anything else gets a friendly not-found page.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const p = url.searchParams;
  if (p.get("shop") || p.get("host") || p.get("embedded")) throw redirect(`/app?${p.toString()}`);
  return data(null, { status: 404 });
};

export const meta: MetaFunction = () => [{ title: "Employee Perks: page not found" }];

export default function NotFound() {
  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 20px", font: "16px/1.6 system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Page not found</h1>
      <p>
        Open Employee Perks from your Shopify admin under <strong>Apps</strong>, or <a href="/">go to the home page</a>.
      </p>
    </main>
  );
}
