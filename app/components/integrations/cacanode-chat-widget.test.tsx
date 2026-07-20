// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CacanodeChatWidget } from "./cacanode-chat-widget";

beforeEach(() => {
  vi.stubEnv("WIDGET_SCRIPT_SRC", "http://localhost/widget/v1/cacanode-chat.js");
  vi.stubEnv("WIDGET_TOKEN", "ccn_it_test");
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllEnvs();
});

describe("CacanodeChatWidget", () => {
  it("loads the configured widget script once", () => {
    const first = render(<CacanodeChatWidget />);
    const second = render(<CacanodeChatWidget />);

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

    const view = render(<CacanodeChatWidget />);
    view.unmount();

    expect(document.querySelector('iframe[src="http://localhost/widget/widget.html"]')).not.toBeInTheDocument();
    expect(unrelated).toBeInTheDocument();
    expect(document.querySelector("script[data-kuvox-cacanode-chat]")).not.toBeInTheDocument();
  });

  it("stays disabled when widget configuration is incomplete", () => {
    vi.stubEnv("WIDGET_TOKEN", "");

    render(<CacanodeChatWidget />);

    expect(document.querySelector("script[data-kuvox-cacanode-chat]")).not.toBeInTheDocument();
  });
});
