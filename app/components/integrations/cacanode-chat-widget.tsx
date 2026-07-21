import { createContext, useContext, useEffect, type ReactNode } from "react";

const WIDGET_SCRIPT_SELECTOR = "script[data-kuvox-cacanode-chat]";

export interface CacanodeWidgetConfig {
  scriptSrc: string | null;
  token: string | null;
}

const CacanodeWidgetConfigContext = createContext<CacanodeWidgetConfig>({
  scriptSrc: null,
  token: null,
});

export function CacanodeWidgetConfigProvider({
  value,
  children,
}: {
  value: CacanodeWidgetConfig;
  children: ReactNode;
}) {
  return (
    <CacanodeWidgetConfigContext.Provider value={value}>
      {children}
    </CacanodeWidgetConfigContext.Provider>
  );
}

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
  const { scriptSrc, token } = useContext(CacanodeWidgetConfigContext);

  useEffect(() => {
    const normalizedScriptSrc = scriptSrc?.trim();
    const normalizedToken = token?.trim();
    if (!normalizedScriptSrc || !normalizedToken) return undefined;

    const widgetUrl = new URL(normalizedScriptSrc, window.location.href);
    let script = document.querySelector<HTMLScriptElement>(WIDGET_SCRIPT_SELECTOR);
    let active = true;

    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.src = widgetUrl.href;
      script.dataset.token = normalizedToken;
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
  }, [scriptSrc, token]);

  return null;
}
