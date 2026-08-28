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
import WalletAssets from "../views/WalletAssets.vue";
import WalletBackup from '../views/WalletBackup.vue'
import Settings from "../views/Settings.vue";
import About from "../views/About.vue";
import WallpaperPicker from "../views/WallpaperPicker.vue";
import NetworkStatus from "../views/NetworkStatus.vue";
import { settings } from "../stores/settings";
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
      path: "/wallet/assets",
      component: WalletAssets,
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
    {
      path: "/payroll",
      component: () => import("../views/payroll/PayrollHome.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/recipients",
      component: () => import("../views/payroll/RecipientsList.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/recipients/import",
      component: () => import("../views/payroll/RecipientImport.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/recipients/:id",
      component: () => import("../views/payroll/RecipientForm.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/recipients/:id/history",
      component: () => import("../views/payroll/RecipientHistory.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/runs/new",
      component: () => import("../views/payroll/RunNew.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/runs",
      component: () => import("../views/payroll/RunHistory.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/export",
      component: () => import("../views/payroll/PayrollExport.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/backup",
      component: () => import("../views/payroll/PayrollBackup.vue"),
      meta: { showNavbar: true }
    },
    {
      path: "/payroll/runs/:id",
      component: () => import("../views/payroll/RunDetail.vue"),
      meta: { showNavbar: true }
    },
    {
      // Top-level (not under /payroll) and not gated by Employer mode: the
      // person verifying a receipt is typically the recipient, not the
      // employer, so this must work with Employer mode off.
      path: "/receipts/verify",
      component: () => import("../views/ReceiptVerify.vue"),
      meta: { showNavbar: true }
    },
    {
      // Parent-route guard: unlike Payroll's flat (unguarded) routes, POS
      // needs a hard block when Merchant mode is off, since it's reached
      // via deep link / QR / restored route as well as the nav entry.
      // Guarding the parent covers every child below it in one place.
      path: "/pos",
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.merchantMode ? true : "/wallet/balance");
      },
      children: [
        { path: "", component: () => import("../views/pos/PosHome.vue") },
        { path: "history", component: () => import("../views/pos/PosHistory.vue") },
      ],
    },
    {
      path: "/extension/connect/:id",
      component: () => import("../views/extension/ConnectRequest.vue"),
    },
    {
      path: "/extension/approve/:id",
      component: () => import("../views/extension/ApproveRequest.vue"),
    },
  ]
});
