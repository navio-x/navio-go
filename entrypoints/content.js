import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { PROVIDER_CHANNEL, CONTENT_CHANNEL, MESSAGE_TYPE } from "@/lib/extensionProtocol.js";

// Isolated-world bridge: relays window.postMessage traffic from the MAIN
// world provider (entrypoints/provider.content.js) to the background service
// worker, which is the only place that has chrome.runtime access.
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  world: "ISOLATED",
  main() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const message = event.data;
      if (!message || message.channel !== PROVIDER_CHANNEL) return;

      browser.runtime
        .sendMessage({
          type: MESSAGE_TYPE.PROVIDER_REQUEST,
          id: message.id,
          method: message.method,
          params: message.params,
        })
        .then((result) => {
          window.postMessage(
            { channel: CONTENT_CHANNEL, id: message.id, result },
            window.location.origin
          );
        })
        .catch((error) => {
          window.postMessage(
            {
              channel: CONTENT_CHANNEL,
              id: message.id,
              error: { code: error?.code ?? -1, message: error?.message ?? String(error) },
            },
            window.location.origin
          );
        });
    });
  },
});
