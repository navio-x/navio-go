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
app.mount("#app");