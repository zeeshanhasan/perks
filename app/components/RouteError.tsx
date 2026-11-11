import { useEffect, useRef } from "react";
import { isRouteErrorResponse, useRevalidator, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

/**
 * A page's error boundary: keeps the app layout and nav, retries once by itself, then offers "Try again".
 * Responses (auth, redirects, 4xx) still go to Shopify's boundary, which needs them.
 */
export function RouteError({ heading }: { heading: string }) {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const retried = useRef(false);
  const isResponse = isRouteErrorResponse(error) || error instanceof Response;

  useEffect(() => {
    if (isResponse || retried.current) return;
    retried.current = true;
    const t = setTimeout(() => revalidator.revalidate(), 1500);
    return () => clearTimeout(t);
  }, [isResponse, revalidator]);

  if (isResponse) return boundary.error(error);
  const busy = revalidator.state !== "idle" || !retried.current;
  return (
    <s-page heading={heading}>
      <s-section>
        <s-stack gap="base" alignItems="center" padding="large">
          {busy ? (
            <>
              <s-spinner accessibilityLabel="Loading" />
              <s-text color="subdued">Loading…</s-text>
            </>
          ) : (
            <>
              <s-heading>This page didn&apos;t load</s-heading>
              <s-text color="subdued">It&apos;s usually a short hiccup with Shopify. Your settings are safe.</s-text>
              <s-button variant="primary" onClick={() => revalidator.revalidate()}>
                Try again
              </s-button>
            </>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}
