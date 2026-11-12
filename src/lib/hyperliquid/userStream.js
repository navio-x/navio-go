import { HL_WS_URL } from "./config";

const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 30_000;

/**
 * One websocket per user address, shared by every listener on the screen
 * (open orders, trade history): subscribed to `orderUpdates` (pushed on each
 * status change — no snapshot) and `userFills` (a snapshot on subscribe,
 * then each new fill). Reconnects with backoff, pings every 30 s, and closes
 * once the last listener leaves. Listeners keep their own REST path for the
 * snapshot and for while the socket is down — `onOpen`/`onClose` tell them
 * which state they are in.
 */
const streams = new Map();

function createStream(user) {
  const listeners = new Set();
  let ws = null;
  let pingTimer = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  let closed = false;
  const stream = { connected: false, listeners, close };

  function notify(name, ...args) {
    for (const l of listeners) {
      try {
        l[name]?.(...args);
      } catch (e) {
        console.error(`[hyperliquid] user stream ${name} listener failed:`, e);
      }
    }
  }

  function send(msg) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function stopTimers() {
    if (pingTimer) clearInterval(pingTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    pingTimer = null;
    reconnectTimer = null;
  }

  function open() {
    if (closed) return;
    try {
      ws = new WebSocket(HL_WS_URL);
    } catch (e) {
      console.error("[hyperliquid] user stream ws unavailable:", e);
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      reconnectDelay = 1000;
      stream.connected = true;
      send({ method: "subscribe", subscription: { type: "orderUpdates", user } });
      send({ method: "subscribe", subscription: { type: "userFills", user } });
      pingTimer = setInterval(() => send({ method: "ping" }), PING_INTERVAL_MS);
      notify("onOpen");
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.channel === "orderUpdates" && Array.isArray(msg.data)) notify("onOrderUpdates", msg.data);
        else if (msg?.channel === "userFills" && msg.data) notify("onUserFills", msg.data.fills || [], !!msg.data.isSnapshot);
      } catch (e) {
        console.error("[hyperliquid] user stream message parse failed:", e);
      }
    };
    ws.onclose = (event) => {
      console.log("[hyperliquid] user stream ws closed — code:", event.code, "reason:", event.reason, "wasClean:", event.wasClean);
      const wasConnected = stream.connected;
      stream.connected = false;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      if (wasConnected) notify("onClose");
      scheduleReconnect();
    };
    ws.onerror = (event) => {
      console.error("[hyperliquid] user stream ws error:", event);
      try {
        ws?.close();
      } catch {
        // onclose reconnects either way
      }
    };
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      open();
    }, reconnectDelay);
  }

  function close() {
    closed = true;
    stopTimers();
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        // already closing/closed
      }
      ws = null;
    }
    stream.connected = false;
  }

  open();
  return stream;
}

/**
 * Starts listening to `user`'s stream. `listener` may define onOpen(),
 * onClose(), onOrderUpdates(updates) and onUserFills(fills, isSnapshot);
 * onOpen fires right away when the shared socket is already up. Returns the
 * function that stops listening (and closes the socket when nobody else is).
 */
export function subscribeUserStream(user, listener) {
  let stream = streams.get(user);
  if (!stream) {
    stream = createStream(user);
    streams.set(user, stream);
  }
  stream.listeners.add(listener);
  if (stream.connected) listener.onOpen?.();
  return () => {
    stream.listeners.delete(listener);
    if (stream.listeners.size === 0 && streams.get(user) === stream) {
      stream.close();
      streams.delete(user);
    }
  };
}
