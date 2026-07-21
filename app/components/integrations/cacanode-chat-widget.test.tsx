// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  CacanodeChatWidget,
  CacanodeWidgetConfigProvider,
  type CacanodeWidgetConfig,
} from "./cacanode-chat-widget";

const configuredWidget: CacanodeWidgetConfig = {
  scriptSrc: "http://localhost/widget/v1/cacanode-chat.js",
  token: "ccn_it_test",
};

function renderWidget(value: CacanodeWidgetConfig = configuredWidget) {
  return render(
    <CacanodeWidgetConfigProvider value={value}>
      <CacanodeChatWidget />
    </CacanodeWidgetConfigProvider>,
  );
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("CacanodeChatWidget", () => {
  it("loads the configured widget script once", () => {
    const first = renderWidget();
    const second = renderWidget();

    const scripts = document.querySelectorAll<HTMLScriptElement>("script[data-kuvox-cacanode-chat]");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toHaveAttribute("src", "http://localhost/widget/v1/cacanode-chat.js");
    expect(scripts[0]).toHaveAttribute("data-token");
    expect(scripts[0]?.async).toBe(true);

    second.unmount();
    first.unmount();
  });

  it("removes the widget iframe when its route layout unmounts", () => {
    const unrelated = document.createElement("iframe");
    unrelated.title = "Customer support chat";
    unrelated.src = "http://example.com/widget/widget.html";
    document.body.appendChild(unrelated);

    const widgetFrame = document.createElement("iframe");
    widgetFrame.title = "Customer support chat";
    widgetFrame.src = "http://localhost/widget/widget.html";
    document.body.appendChild(widgetFrame);

    const view = renderWidget();
    view.unmount();

    expect(document.querySelector('iframe[src="http://localhost/widget/widget.html"]')).not.toBeInTheDocument();
    expect(unrelated).toBeInTheDocument();
    expect(document.querySelector("script[data-kuvox-cacanode-chat]")).not.toBeInTheDocument();
  });

  it("stays disabled when widget configuration is incomplete", () => {
    renderWidget({ ...configuredWidget, token: null });

    expect(document.querySelector("script[data-kuvox-cacanode-chat]")).not.toBeInTheDocument();
  });
});
