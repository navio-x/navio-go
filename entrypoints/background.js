import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { MESSAGE_TYPE, ERROR_CODE, approvalRouteForMethod } from "@/lib/extensionProtocol.js";

const PENDING_STORAGE_KEY = "pendingRequests";

async function readPendingRequests() {
  const stored = await browser.storage.session.get(PENDING_STORAGE_KEY);
  return stored[PENDING_STORAGE_KEY] ?? {};
}

async function writePendingRequest(request) {
  const all = await readPendingRequests();
  all[request.id] = request;
  await browser.storage.session.set({ [PENDING_STORAGE_KEY]: all });
}

async function removePendingRequest(id) {
  const all = await readPendingRequests();
  delete all[id];
  await browser.storage.session.set({ [PENDING_STORAGE_KEY]: all });
}

export default defineBackground(() => {
  // requestId -> { resolve, reject, windowId }
  // In-memory only: if the service worker is evicted mid-approval the
  // request is lost and the dApp promise never settles. Acceptable for now
  // (approvals happen within seconds); hardening this is future work once
  // real signing/NFT approval flows land.
  const pendingResolvers = new Map();

  async function handleProviderRequest(message, sender) {
    const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : "unknown");

    return new Promise((resolve, reject) => {
      pendingResolvers.set(message.id, { resolve, reject });

      (async () => {
        await writePendingRequest({
          id: message.id,
          origin,
          method: message.method,
          params: message.params ?? null,
          tabId: sender.tab?.id,
          createdAt: Date.now(),
        });

        const route = approvalRouteForMethod(message.method);
        const popupUrl = browser.runtime.getURL(
          `/popup.html#/extension/${route}/${message.id}`
        );
        // width/height are OUTER window bounds on Chrome (title bar + borders
        // included), so the usable content area ends up smaller than
        // requested. Pad generously so the popup content (380x600, see
        // entrypoints/popup/index.html) isn't clipped on open.
        const win = await browser.windows.create({
          url: popupUrl,
          type: "popup",
          width: 420,
          height: 720,
        });

        const resolver = pendingResolvers.get(message.id);
        if (resolver) resolver.windowId = win.id;
      })().catch((err) => {
        pendingResolvers.delete(message.id);
        reject(err);
      });
    });
  }

  async function handleGetPendingRequest(message) {
    const all = await readPendingRequests();
    return all[message.id] ?? null;
  }

  async function settleRequest(id, { result, error }) {
    const resolver = pendingResolvers.get(id);
    if (!resolver) return { ok: false };

    pendingResolvers.delete(id);
    if (error) resolver.reject(error);
    else resolver.resolve(result);

    await removePendingRequest(id);
    if (resolver.windowId != null) {
      browser.windows.remove(resolver.windowId).catch(() => {});
    }
    return { ok: true };
  }

  browser.runtime.onMessage.addListener((message, sender) => {
    if (!message || typeof message !== "object") return undefined;

    switch (message.type) {
      case MESSAGE_TYPE.PROVIDER_REQUEST:
        return handleProviderRequest(message, sender);
      case MESSAGE_TYPE.GET_PENDING_REQUEST:
        return handleGetPendingRequest(message);
      case MESSAGE_TYPE.RESOLVE_REQUEST:
        return settleRequest(message.id, { result: message.result });
      case MESSAGE_TYPE.REJECT_REQUEST:
        return settleRequest(message.id, { error: message.error });
      default:
        return undefined;
    }
  });

  // Closing the approval popup without answering counts as a rejection,
  // otherwise the dApp's request() promise would hang forever.
  browser.windows.onRemoved.addListener((closedWindowId) => {
    for (const [id, resolver] of pendingResolvers) {
      if (resolver.windowId === closedWindowId) {
        pendingResolvers.delete(id);
        resolver.reject({ code: ERROR_CODE.USER_REJECTED, message: "User closed the approval window" });
        removePendingRequest(id).catch(() => {});
      }
    }
  });
});
