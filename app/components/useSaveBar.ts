import { useCallback, useLayoutEffect } from "react";
import { useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

/**
 * App Bridge leaves the admin save bar showing if its <ui-save-bar> element is removed while open.
 * Hide it while the element is still attached: before navigating away, and in a layout-effect
 * cleanup (runs before React detaches the DOM on unmount).
 */
export function useSaveBar(id: string) {
  const shopify = useAppBridge();
  const navigate = useNavigate();

  useLayoutEffect(() => () => void shopify.saveBar.hide(id).catch(() => {}), [shopify, id]);

  const hide = useCallback(() => shopify.saveBar.hide(id).catch(() => {}), [shopify, id]);
  const leave = useCallback(
    async (to: string) => {
      await hide();
      navigate(to);
    },
    [hide, navigate],
  );
  return { hide, leave };
}
