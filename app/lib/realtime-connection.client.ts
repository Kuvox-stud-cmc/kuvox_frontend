const RECORD_SEPARATOR = "\x1e";
const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 15000;

export type RealtimeTarget = "mediaUpdated" | "renderJobUpdated";

export interface RealtimeConnectionState {
  state: "connected" | "disconnected";
  reconnected: boolean;
}

type EventHandler = (payload: unknown) => void;
type LifecycleHandler = (state: RealtimeConnectionState) => void;

export interface RealtimeConnection {
  subscribe(target: RealtimeTarget, handler: EventHandler): () => void;
  subscribeLifecycle(handler: LifecycleHandler): () => void;
}

interface RealtimeConnectionDependencies {
  createSocket: (url: string) => WebSocket;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
  hubUrl: () => string;
}

export function createRealtimeConnection(
  dependencies: RealtimeConnectionDependencies = browserDependencies(),
): RealtimeConnection {
  const eventHandlers = new Map<RealtimeTarget, Set<EventHandler>>();
  const lifecycleHandlers = new Set<LifecycleHandler>();
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let retryMs = INITIAL_RETRY_MS;
  let connectedOnce = false;
  let stopped = true;

  const hasSubscribers = () =>
    lifecycleHandlers.size > 0 || [...eventHandlers.values()].some((handlers) => handlers.size > 0);

  const notifyLifecycle = (state: RealtimeConnectionState) => {
    lifecycleHandlers.forEach((handler) => handler(state));
  };

  const scheduleReconnect = () => {
    if (stopped || !hasSubscribers() || reconnectTimer !== null) return;
    const delay = retryMs;
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    reconnectTimer = dependencies.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (stopped || socket || !hasSubscribers()) return;

    const nextSocket = dependencies.createSocket(dependencies.hubUrl());
    socket = nextSocket;
    nextSocket.onopen = () => {
      nextSocket.send(`${JSON.stringify({ protocol: "json", version: 1 })}${RECORD_SEPARATOR}`);
    };
    nextSocket.onmessage = (event) => {
      for (const rawMessage of String(event.data).split(RECORD_SEPARATOR)) {
        if (!rawMessage) continue;
        const message = parseMessage(rawMessage);
        if (!message) continue;

        if (message.type === undefined && message.error === undefined) {
          const reconnected = connectedOnce;
          connectedOnce = true;
          retryMs = INITIAL_RETRY_MS;
          notifyLifecycle({ state: "connected", reconnected });
          continue;
        }

        if (message.type !== 1 || !isRealtimeTarget(message.target)) continue;
        const payload = message.arguments?.[0];
        eventHandlers.get(message.target)?.forEach((handler) => handler(payload));
      }
    };
    nextSocket.onclose = () => {
      if (socket !== nextSocket) return;
      socket = null;
      if (stopped) return;
      notifyLifecycle({ state: "disconnected", reconnected: false });
      scheduleReconnect();
    };
    nextSocket.onerror = () => nextSocket.close();
  };

  const start = () => {
    stopped = false;
    connect();
  };

  const stopIfUnused = () => {
    if (hasSubscribers()) return;
    stopped = true;
    if (reconnectTimer !== null) {
      dependencies.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const activeSocket = socket;
    socket = null;
    activeSocket?.close();
  };

  return {
    subscribe(target, handler) {
      const handlers = eventHandlers.get(target) ?? new Set<EventHandler>();
      handlers.add(handler);
      eventHandlers.set(target, handlers);
      start();
      return () => {
        handlers.delete(handler);
        stopIfUnused();
      };
    },
    subscribeLifecycle(handler) {
      lifecycleHandlers.add(handler);
      start();
      return () => {
        lifecycleHandlers.delete(handler);
        stopIfUnused();
      };
    },
  };
}

let sharedConnection: RealtimeConnection | null = null;

export function getRealtimeConnection(): RealtimeConnection {
  sharedConnection ??= createRealtimeConnection();
  return sharedConnection;
}

function browserDependencies(): RealtimeConnectionDependencies {
  return {
    createSocket: (url) => new WebSocket(url),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (id) => window.clearTimeout(id),
    hubUrl: () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/hubs/media`;
    },
  };
}

function parseMessage(value: string): SignalRMessage | null {
  try {
    return JSON.parse(value) as SignalRMessage;
  } catch {
    return null;
  }
}

function isRealtimeTarget(value: unknown): value is RealtimeTarget {
  return value === "mediaUpdated" || value === "renderJobUpdated";
}

interface SignalRMessage {
  type?: number;
  target?: unknown;
  arguments?: unknown[];
  error?: string;
}
