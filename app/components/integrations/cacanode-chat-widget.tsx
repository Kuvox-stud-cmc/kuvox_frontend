import { useEffect } from "react";

const WIDGET_SCRIPT_SELECTOR = "script[data-kuvox-cacanode-chat]";

function removeWidgetFrames(widgetOrigin: string) {
  document.querySelectorAll<HTMLIFrameElement>('iframe[title="Customer support chat"]').forEach((frame) => {
    try {
      const frameUrl = new URL(frame.src, window.location.href);
      if (frameUrl.origin === widgetOrigin && frameUrl.pathname === "/widget/widget.html") {
        frame.remove();
      }
    } catch {
      // Ignore unrelated iframes with malformed URLs.
    }
  });
}

/** Loads CacaNode chat only while the containing route layout is mounted. */
export function CacanodeChatWidget() {
  useEffect(() => {
    const scriptSrc = import.meta.env.WIDGET_SCRIPT_SRC?.trim();
    const token = import.meta.env.WIDGET_TOKEN?.trim();
    if (!scriptSrc || !token) return undefined;

    const widgetUrl = new URL(scriptSrc, window.location.href);
    let script = document.querySelector<HTMLScriptElement>(WIDGET_SCRIPT_SELECTOR);
    let active = true;

    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.src = widgetUrl.href;
      script.dataset.token = token;
      script.dataset.kuvoxCacanodeChat = "true";
      document.body.appendChild(script);
    }

    const removeLateFrame = () => {
      if (!active && !document.querySelector(WIDGET_SCRIPT_SELECTOR)) {
        removeWidgetFrames(widgetUrl.origin);
      }
    };
    script.addEventListener("load", removeLateFrame, { once: true });

    return () => {
      active = false;
      script.remove();
      removeWidgetFrames(widgetUrl.origin);
    };
  }, []);

  return null;
}
