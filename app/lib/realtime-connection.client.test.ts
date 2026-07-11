import { describe, expect, it, vi } from "vitest";

import { createRealtimeConnection } from "./realtime-connection.client";

const RS = "\x1e";

class FakeSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];

  send(value: string) {
    this.sent.push(value);
  }

  close() {
    this.onclose?.({} as CloseEvent);
  }

  open() {
    this.onopen?.({} as Event);
  }

  message(value: unknown) {
    this.onmessage?.({ data: value } as MessageEvent);
  }
}

describe("shared realtime connection", () => {
  it("multiplexes events on one socket with independent unsubscription", () => {
    const sockets: FakeSocket[] = [];
    const media = vi.fn();
    const render = vi.fn();
    const connection = createRealtimeConnection({
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      hubUrl: () => "ws://test/hubs/media",
    });

    const unsubscribeMedia = connection.subscribe("mediaUpdated", media);
    const unsubscribeRender = connection.subscribe("renderJobUpdated", render);

    expect(sockets).toHaveLength(1);
    sockets[0].open();
    expect(sockets[0].sent).toEqual([`${JSON.stringify({ protocol: "json", version: 1 })}${RS}`]);
    sockets[0].message(`{}${RS}${JSON.stringify({
      type: 1,
      target: "mediaUpdated",
      arguments: [{ media: { id: "media-1" } }],
    })}${RS}${JSON.stringify({
      type: 1,
      target: "renderJobUpdated",
      arguments: [{ jobId: "job-1", status: "rendering" }],
    })}${RS}`);

    expect(media).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);

    unsubscribeMedia();
    sockets[0].message(`${JSON.stringify({
      type: 1,
      target: "renderJobUpdated",
      arguments: [{ jobId: "job-1", status: "completed" }],
    })}${RS}`);
    expect(render).toHaveBeenCalledTimes(2);
    expect(sockets).toHaveLength(1);

    unsubscribeRender();
  });

  it("reports reconnects and applies exponential retry backoff", () => {
    const sockets: FakeSocket[] = [];
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    const lifecycle = vi.fn();
    const connection = createRealtimeConnection({
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      setTimeout: (callback, delay) => {
        scheduled.push({ callback, delay });
        return scheduled.length;
      },
      clearTimeout: vi.fn(),
      hubUrl: () => "ws://test/hubs/media",
    });

    const unsubscribe = connection.subscribeLifecycle(lifecycle);
    sockets[0].open();
    sockets[0].message(`{}${RS}`);
    expect(lifecycle).toHaveBeenLastCalledWith({ state: "connected", reconnected: false });

    sockets[0].close();
    expect(scheduled[0].delay).toBe(1000);
    scheduled[0].callback();
    sockets[1].close();
    expect(scheduled[1].delay).toBe(2000);
    scheduled[1].callback();
    sockets[2].open();
    sockets[2].message(`{}${RS}`);
    expect(lifecycle).toHaveBeenLastCalledWith({ state: "connected", reconnected: true });

    unsubscribe();
  });
});
