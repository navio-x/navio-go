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
import { isSdkReady } from "../stores/navio";

const router = createRouter({
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
      // dexMode kapalıyken erişilemez: menüde görünmez ama kullanıcı URL'i
      // elle yazarsa veya eski bir route restore edilirse ana sayfaya
      // yönlendirilir. (Bkz. App.vue'daki "zaten oradayken kapatıldı" durumu
      // için ek watch — merchantMode/pos ile aynı desen.)
      path: "/dex",
      component: () => import("../views/DexView.vue"),
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.dexMode ? true : "/wallet/balance");
      },
    },
    {
      // Hyperliquid spot asset (USDC/HYPE/BTC): balance, deposit (own EVM
      // address + QR) and withdraw to an EVM address. Gated by dexMode.
      path: "/hl/asset/:symbol",
      component: () => import("../views/market/HlAsset.vue"),
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.dexMode ? true : "/wallet/balance");
      },
    },
    {
      // Swap: from / to / amount. Moving NAV between the wallet and the
      // exchange is worked out by lib/intent, not asked of the user.
      path: "/swap",
      component: () => import("../views/SwapView.vue"),
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.dexMode ? true : "/wallet/balance");
      },
    },
    {
      // NAV as one asset (wallet + exchange), with the explicit move
      // between the two under Advanced. Works with dexMode off too — it
      // then simply shows the wallet.
      path: "/asset/NAV",
      component: () => import("../views/NavAsset.vue"),
      meta: { showNavbar: true },
    },
    // Old "Wrapped Navio" account page — now part of the NAV page.
    { path: "/market/hl/:pair/account", redirect: "/asset/NAV" },
    {
      // Candlestick price chart for a Hyperliquid spot pair — reached from
      // the market screen's header icon. Gated by dexMode like /market/hl.
      path: "/market/hl/:pair/chart",
      component: () => import("../views/market/MarketChart.vue"),
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.dexMode ? true : "/wallet/balance");
      },
    },
    {
      // Hyperliquid market screen (full order book + balances for a spot
      // pair, e.g. "NAV-USDC") — reached from the DEX tab's Hyperliquid
      // card or the assets list, so gated by dexMode same as /dex itself.
      path: "/market/hl/:pair",
      component: () => import("../views/market/MarketScreen.vue"),
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.dexMode ? true : "/wallet/balance");
      },
    },
    {
      // Navio <-> Hyperliquid custodial bridge — deposit into HyperCore and
      // withdraw back out. Reached from MarketScreen's NAV/USDC screen, so
      // gated by dexMode the same way /dex and /market/hl are.
      path: "/bridge/deposit",
      component: () => import("../views/bridge/BridgeDeposit.vue"),
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.dexMode ? true : "/wallet/balance");
      },
    },
    {
      path: "/bridge/withdraw",
      component: () => import("../views/bridge/BridgeWithdraw.vue"),
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.dexMode ? true : "/wallet/balance");
      },
    },
    {
      // tradeMode kapalıyken erişilemez: menüde görünmez ama kullanıcı URL'i
      // elle yazarsa veya eski bir route restore edilirse ana sayfaya
      // yönlendirilir. (Bkz. App.vue'daki "zaten oradayken kapatıldı" durumu
      // için ek watch — merchantMode/pos ve dexMode/dex ile aynı desen.)
      // Not: bu, stores/evm.js'deki EVM/BSC köprüsü "dex"ten ayrı, Navio'nun
      // kendi p2p RFQ alım-satımı — bkz. stores/trade.js. Parent-route guard
      // (POS ile aynı desen) altındaki tüm alt sayfaları tek yerden korur —
      // Assets/token detay ekranları köprü durumundan bağımsız, sadece
      // tradeMode'a bağlıdır (bkz. stores/trade.js Phase 2 yorumu).
      path: "/trade",
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.tradeMode ? true : "/wallet/balance");
      },
      children: [
        { path: "", component: () => import("../views/trade/TradeHome.vue") },
        { path: "assets", component: () => import("../views/trade/TradeAssets.vue") },
        { path: "assets/:tokenId", component: () => import("../views/trade/TradeTokenDetail.vue") },
        { path: "take", component: () => import("../views/trade/TradeTakeRequest.vue") },
        { path: "take/:uuid", component: () => import("../views/trade/TradeQuotes.vue") },
        { path: "maker", component: () => import("../views/trade/TradeMakerHome.vue") },
        { path: "maker/intent", component: () => import("../views/trade/TradeMakerIntent.vue") },
        { path: "maker/respond", component: () => import("../views/trade/TradeMakerRespond.vue") },
        { path: "maker/order", component: () => import("../views/trade/TradeMakerOrder.vue") },
        { path: "manage", component: () => import("../views/trade/TradeManage.vue") },
        { path: "history", component: () => import("../views/trade/TradeHistory.vue") },
      ],
    },
    {
      // chatMode kapalıyken erişilemez: menüde görünmez ama kullanıcı URL'i
      // elle yazarsa veya eski bir route restore edilirse ana sayfaya
      // yönlendirilir. (Bkz. App.vue'daki "zaten oradayken kapatıldı" durumu
      // için ek watch — merchantMode/pos, dexMode/dex ve tradeMode/trade ile
      // aynı desen.) Parent-route guard altındaki tüm alt sayfaları (kişi
      // listesi, kişi formu, sohbet ekranı) tek yerden korur.
      path: "/chat",
      meta: { showNavbar: true },
      beforeEnter: (to, from, next) => {
        next(settings.chatMode ? true : "/wallet/balance");
      },
      children: [
        { path: "", component: () => import("../views/chat/ChatContacts.vue") },
        { path: "contacts/new", component: () => import("../views/chat/ChatContactForm.vue") },
        { path: "contacts/:id/edit", component: () => import("../views/chat/ChatContactForm.vue") },
        { path: "group/new", component: () => import("../views/chat/GroupCreate.vue") },
        // The two actual conversation screens override the parent's
        // showNavbar: true — a chat thread wants its full height for
        // messages + the keyboard, same as WhatsApp/Telegram, which is why
        // ChatConversation/GroupConversation are laid out with a fixed
        // header+composer (h-full, not min-h-screen) rather than scrolling
        // under a bottom nav.
        { path: "group/:groupId", component: () => import("../views/chat/GroupConversation.vue"), meta: { showNavbar: false } },
        { path: "group/:groupId/manage", component: () => import("../views/chat/GroupManage.vue") },
        { path: ":contactId", component: () => import("../views/chat/ChatConversation.vue"), meta: { showNavbar: false } },
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

// Every screen past the start screen assumes the SDK is initialised and (for
// most of them) that a wallet is loaded — both live only in memory. If the
// app comes up directly on such a route (page reload, the OS restoring a
// backgrounded WebView, a dev-server reload), send it through "/" first,
// which initialises the SDK and then routes to the wallet list or welcome.
// The extension's approval windows initialise the SDK themselves, and the
// receipt verifier is reachable on its own.
const BOOTS_ITSELF = ["/", "/receipts/verify"];
router.beforeEach((to) => {
  if (isSdkReady()) return true;
  if (BOOTS_ITSELF.includes(to.path) || to.path.startsWith("/extension/")) return true;
  return "/";
});

export default router;
