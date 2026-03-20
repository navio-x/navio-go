import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import './style.css'
import { Buffer } from "buffer";
console.log("Navio Go");
sessionStorage.clear();
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount("#app");