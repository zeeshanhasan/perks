import { useEffect, useRef, useState } from "react";
import { useFetchers, useNavigation, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

// App-wide connection and loading feedback, shown on every app page:
// - Shopify's loading bar at the top of the admin while a page or save is in progress.
// - A notice when the internet is down (and a quiet refresh when it's back).
// - A "still loading" notice when a page takes unusually long, with Try again.

const SLOW_MS = 8000;

export function AppStatus() {
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  // Saves run through fetchers; without watching them a stalled save spins with no message at all.
  const saving = useFetchers().some((f) => f.state !== "idle" && f.formMethod && f.formMethod.toUpperCase() !== "GET");
  const busy = navigation.state !== "idle" || revalidator.state !== "idle" || saving;
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);
  const wasOffline = useRef(false);

  // Shopify's own loading bar.
  useEffect(() => {
    try {
      shopify.loading(busy);
    } catch {
      /* App Bridge not ready yet */
    }
  }, [busy, shopify]);

  // Slow page: only after SLOW_MS of continuous loading.
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [busy]);

  // Online / offline.
  useEffect(() => {
    const update = () => {
      const on = navigator.onLine;
      setOnline(on);
      if (!on) wasOffline.current = true;
      else if (wasOffline.current) {
        wasOffline.current = false;
        revalidator.revalidate(); // back online: refresh what's on screen
      }
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
    // revalidator changes identity on every render; the listener only needs the latest call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!online)
    return (
      <s-banner tone="warning" heading="You're offline">
        Changes can&apos;t be saved until your connection is back. This page refreshes by itself when it is.
      </s-banner>
    );
  if (slow && saving)
    return (
      <s-banner tone="warning" heading="Still saving">
        Your connection or Shopify is slow right now. If this doesn&apos;t finish in a minute,{" "}
        <s-link onClick={() => window.location.reload()}>reload the page</s-link> and check whether your change was
        saved before trying again.
      </s-banner>
    );
  if (slow)
    return (
      <s-banner tone="info" heading="Still loading">
        Your connection or Shopify is slow right now.{" "}
        <s-link onClick={() => window.location.reload()}>Try again</s-link>
      </s-banner>
    );
  return null;
}
