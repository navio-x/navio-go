import { defineContentScript } from "wxt/utils/define-content-script";
import { PROVIDER_CHANNEL, CONTENT_CHANNEL } from "@/lib/extensionProtocol.js";

// Runs in the page's own JS context (world: MAIN) so it can define
// window.navio the same way MetaMask defines window.ethereum. It has no
// chrome.runtime access here, so every call is bridged through
// entrypoints/content.js via postMessage.
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    if (window.navio) return;

    const pending = new Map();

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const message = event.data;
      if (!message || message.channel !== CONTENT_CHANNEL) return;

      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);

      if (message.error) waiter.reject(message.error);
      else waiter.resolve(message.result);
    });

    function request({ method, params } = {}) {
      if (!method) return Promise.reject(new Error("navio.request: 'method' is required"));

      const id = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        window.postMessage(
          { channel: PROVIDER_CHANNEL, id, method, params },
          window.location.origin
        );
      });
    }

    window.navio = {
      isNavio: true,
      request,
      // Placeholder event API (account/network change notifications) so
      // dApps can code against the same shape MetaMask exposes. Not wired to
      // real events yet.
      on() {},
      removeListener() {},
    };

    window.dispatchEvent(new Event("navio#initialized"));
  },
});
