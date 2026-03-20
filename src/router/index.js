import { createRouter, createWebHashHistory } from "vue-router";
import InitalizeSDK from "../views/InitalizeSDK.vue";
import Welcome from "../views/Welcome.vue";
import Agreement from "../views/Agreement.vue";
import WalletHome from "../views/WalletHome.vue";
import CreateWallet from "../views/CreateWallet.vue";
import ImportWallet from "../views/ImportWallet.vue";
import MnemonicGenerate from "../views/MnemonicGenerate.vue";
import MnemonicVerify from "../views/MnemonicVerify.vue";
import WalletBalance from "../views/WalletBalance.vue";
import WalletSend from "../views/WalletSend.vue";
import WalletReceive from "../views/WalletReceive.vue";
import WalletHistory from "../views/WalletHistory.vue";
import WalletBackup from '../views/WalletBackup.vue'
import Settings from "../views/Settings.vue";
import About from "../views/About.vue";
import WallpaperPicker from "../views/WallpaperPicker.vue";
import NetworkStatus from "../views/NetworkStatus.vue";
export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: InitalizeSDK },
    { path: "/welcome", component: Welcome },
    { path: "/agreement", component: Agreement },
    { path: "/wallet/home", component: WalletHome },
    { path: "/wallet/mnemonic", component: MnemonicGenerate },
    { path: "/wallet/create", component: CreateWallet },
    { path: "/wallet/import", component: ImportWallet },
    { path: "/wallet/verify", component: MnemonicVerify },
    { 
      path: "/wallet/balance", 
      component: WalletBalance,
      meta: { showNavbar: true }
    },
    { 
      path: "/wallet/send", 
      component: WalletSend,
      meta: { showNavbar: true }
    },
    { 
      path: "/wallet/receive", 
      component: WalletReceive,
      meta: { showNavbar: true }
    },
    { 
      path: "/wallet/history", 
      component: WalletHistory,
      meta: { showNavbar: true }
    },
    { 
      path: "/settings", 
      component: Settings,
      meta: { showNavbar: true }
    },
    {
      path: "/wallet/backup",
      component: WalletBackup,
      meta: { showNavbar: true }
    },
    {
      path: "/about",
      component: About,
      meta: { showNavbar: true }
    },
    {
      path: "/settings/wallpaper",
      component: WallpaperPicker,
    },
    {
      path: "/settings/network",
      component: NetworkStatus,
    },
  ]
});
