import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "react-router";

/**
 * Last-resort error page for everything outside /app (the site, privacy, terms, the store's /apps/perks pages).
 * /app has its own boundary that keeps the admin layout. Never shows error details.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{notFound ? "Page not found" : "Something went wrong"} · Employee Perks</title>
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0, font: "16px/1.6 system-ui, -apple-system, sans-serif", color: "#1f2a44", background: "#fff" }}>
        <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 20px" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{notFound ? "Page not found" : "Something went wrong"}</h1>
          <p style={{ margin: "0 0 16px", color: "#5b6478" }}>
            {notFound
              ? "This page doesn't exist."
              : "This page didn't load. It's usually brief: please try again in a minute. Employee discounts at checkout keep working."}
          </p>
          <p style={{ margin: 0 }}>
            {/* "/" is the store's home on /apps/perks pages and the site's home on perks.tofoapp.com. */}
            <a href="/" style={{ color: "#1f2a44" }}>
              Go to the home page
            </a>
          </p>
        </main>
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
