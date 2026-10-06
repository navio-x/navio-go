import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import './style.css'
import { Buffer } from "buffer";
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
console.log("Navio Go");

// Capture beforeinstallprompt as early as possible (fires before Vue mounts)
window.__pwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
});

if (Capacitor.getPlatform() === 'ios') {
  StatusBar.setOverlaysWebView({ overlay: true });
}
sessionStorage.clear();
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);

// Without these, a failed lazy-route chunk load or a synchronous error
// thrown during a component's setup() is swallowed silently in production —
// the URL can even change while the screen stays on the previous page, with
// nothing in the console to explain why. Surface both loudly instead.
app.config.errorHandler = (err, instance, info) => {
  console.error("[app] uncaught error:", err, info);
};
router.onError((error, to, from) => {
  console.error("[router] navigation failed:", to.fullPath, "from", from.fullPath, error);
});

app.mount("#app");