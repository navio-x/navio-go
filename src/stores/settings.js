import { reactive, watch } from 'vue'
import { setSystemBarColors, syncSystemBarsToPage } from '../lib/systemBars'
import { UNLOCK_DURATIONS, forgetAllPasswords } from '../lib/unlockCache'
import { HL_TOKENS } from '../lib/hyperliquid/config'
import { HL_SPOT_MARKETS } from '../lib/hyperliquid/market'

function readStringList(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    if (Array.isArray(v)) return v.filter(x => typeof x === 'string')
  } catch {}
  return fallback
}

const supportedLocales = ['tr', 'en', 'zh', 'ru', 'es', 'pt-BR', 'ko', 'de', 'fr', 'ja']

const getInitialLanguage = () => {
  const saved = localStorage.getItem('language')
  if (saved) return saved
  const lang = navigator.language
  if (supportedLocales.includes(lang)) return lang
  const short = lang.split('-')[0]
  return supportedLocales.includes(short) ? short : 'en'
}

export const settings = reactive({
  language:        getInitialLanguage(),
  currency:        localStorage.getItem('currency')        || 'USD',
  theme:           localStorage.getItem('theme')           || 'device',
  wallpaper:       localStorage.getItem('wallpaper')       || 'default',
  showBlockNumber: localStorage.getItem('showBlockNumber') !== 'false',
  showFiatValue:   localStorage.getItem('showFiatValue')   !== 'false',
  // Ana sayfadaki senkronizasyon göstergesi: 'bar' (en üstte ince, tam
  // genişlik çubuk — varsayılan) veya 'circle' (eski dairesel gösterge).
  // Ana sayfadaki "Piyasalar" listesinde gösterilen Hyperliquid spot
  // çiftleri (lib/hyperliquid/market.js'deki HL_SPOT_MARKETS anahtarları).
  homePairs:       readStringList('homePairs', Object.keys(HL_SPOT_MARKETS)),
  // Ana sayfadaki "Varlıklar" listesinde her zaman gösterilen Hyperliquid
  // tokenları (HL_TOKENS sembolleri). Bakiyesi olan tokenlar bu listede
  // olmasa da gösterilir — bkz. WalletBalance.vue.
  homeAssets:      readStringList('homeAssets', HL_TOKENS.map((t) => t.symbol)),
  syncIndicator:   localStorage.getItem('syncIndicator') === 'circle' ? 'circle' : 'bar',
  // Off by default: batch payroll/freelance payouts. Purely a UI/routing
  // toggle — no payroll code is imported until this is true (see router).
  employerMode:    localStorage.getItem('employerMode')    === 'true',
  // Display label embedded in signed receipts and shown to recipients on
  // the verification screen. Not secret, not payroll data — kept alongside
  // the other plain settings rather than in the encrypted payroll store.
  employerLabel:   localStorage.getItem('employerLabel')   || '',
  // Off by default: QR point-of-sale for physical shops. Same pattern as
  // employerMode — a UI/routing toggle only, no POS code is imported until
  // this is true (see router). Turning it off never deletes merchant data.
  merchantMode:    localStorage.getItem('merchantMode')    === 'true',
  // Display label embedded in signed payment requests and shown to
  // customers before they approve. Not secret — kept alongside the other
  // plain settings rather than in the encrypted merchant store.
  merchantLabel:   localStorage.getItem('merchantLabel')   || '',
  // Confirmation policy for accepting a POS payment. Below this NAV amount,
  // a payment is accepted as soon as it's seen on the network (faster
  // checkout, small double-spend risk); at or above it, merchantRequiredConfirmations
  // blocks are required first (slower, safer against a reorg). See
  // settings.merchantZeroConfThresholdDesc for the trade-off shown to the user.
  merchantZeroConfThreshold:    Number(localStorage.getItem('merchantZeroConfThreshold') ?? 5),
  merchantRequiredConfirmations: Number(localStorage.getItem('merchantRequiredConfirmations') ?? 2),
  // On by default: BSC/EVM DEX katmanı. Kapalıyken menüde DEX görünmez ve
  // tek bir RPC çağrısı bile yapılmaz (bkz. stores/evm.js). chatMode gibi
  // '!== "false"': hiç kaydedilmemişse açık, kullanıcı kapattıysa kapalı kalır.
  dexMode:         localStorage.getItem('dexMode')         !== 'false',
  // 56 = BSC Mainnet, 97 = BSC Testnet.
  evmNetwork:      Number(localStorage.getItem('evmNetwork') ?? 56),
  // Baz puan cinsinden slippage toleransı (100 = %1).
  slippageBps:     Number(localStorage.getItem('slippageBps') ?? 100),
  // Swap işlemi için dakika cinsinden deadline.
  txDeadlineMin:   Number(localStorage.getItem('txDeadlineMin') ?? 5),
  // Off by default: native Navio RFQ peer-to-peer trading (requestQuote /
  // acceptQuote / setSwapIntent / replyQuote — see stores/trade.js). Not to
  // be confused with dexMode above, which is the unrelated EVM/BSC bridge.
  // Kapalıyken menüde görünmez ve köprü probe'u dahil hiçbir RPC çağrısı
  // yapılmaz (bkz. stores/trade.js).
  tradeMode:       localStorage.getItem('tradeMode')       === 'true',
  // On by default: p2p encrypted chat over navio-p2pmsg (see lib/chat/client.js).
  // Açıkken client.js'deki watch(settings.chatMode) init()'i tetikler.
  // '!== "false"' ki hiç kaydedilmemişse (ilk kurulum) varsayılan açık olsun,
  // ama kullanıcı elle kapatırsa (localStorage'da 'false') kapalı kalsın.
  chatMode:        localStorage.getItem('chatMode')        !== 'false',
  // Relay/peer adresleri (virgülle ayrılmış "wss://host/path" / "host:port").
  // Sayfa HTTPS üzerinden servis edildiği için ws:// (TLS'siz) tarayıcıda
  // mixed-content olarak engellenir — bkz. lib/chat/client.js'deki ön kontrol.
  // Varsayılan, go.nav.io'nun Apache'i üzerinden mod_proxy_wstunnel ile
  // 127.0.0.1:28999'daki navio-core p2pmsg node'una proxy'lenen adres.
  chatPeers:       localStorage.getItem('chatPeers')       || 'wss://go.nav.io/chat-relay/',
  // The p2pmsg bus's network picks its P2P magic bytes, which must match
  // whatever chain chatPeers actually runs — a mismatch connects fine over
  // the wire but the node drops the link on the first message (see
  // lib/chat/session.js). Defaults to 'regtest' since chatPeers defaults to
  // a local/dev relay; override to 'mainnet'/'testnet' to match a real relay.
  chatNetwork:     localStorage.getItem('chatNetwork')     || 'regtest',
  // '' = fall back to the wallet name (see client.js's sendContactRequest).
  // Shown to a contact-request recipient before they've saved us as a
  // contact — a wallet name (e.g. "Payroll wallet") isn't a great label for
  // that, so this lets the user set something more personal.
  chatNickname:    localStorage.getItem('chatNickname')     || '',
  // navio-hl-faucet servisinin adresi (NAV karşılığında Hyperliquid'de
  // USDC + HYPE). /quote ve /health uç noktaları bu adresin altında.
  faucetUrl:       localStorage.getItem('faucetUrl')        || 'http://185.86.15.11:8787',
  // Off by default: şifreli cüzdanın şifresini bu cihazda belirli bir süre
  // hatırlar ('off' | '1h' | '24h' | '7d' | '30d' — bkz. lib/unlockCache.js).
  // Süre, şifrenin en son elle girildiği andan itibaren sayılır.
  unlockDuration:  localStorage.getItem('unlockDuration') in UNLOCK_DURATIONS
    ? localStorage.getItem('unlockDuration') : 'off',
  // Off by default: uygulama açılışında cüzdan listesinde beklemek yerine
  // en son açılan cüzdanı kendiliğinden yükler (bkz. WalletHome.vue).
  autoOpenLastWallet: localStorage.getItem('autoOpenLastWallet') === 'true',
})

/** Hatırlanan şifrenin azami yaşı (ms); kapalıysa 0. */
export function unlockMaxAgeMs() {
  return UNLOCK_DURATIONS[settings.unlockDuration] ?? 0
}

// Settings değiştiğinde localStorage'a kaydet
watch(() => settings.language, (val) => {
  localStorage.setItem('language', val)
})

watch(() => settings.currency, (val) => {
  localStorage.setItem('currency', val)
})

watch(() => settings.wallpaper, (val) => {
  localStorage.setItem('wallpaper', val)
})

watch(() => settings.showBlockNumber, (val) => {
  localStorage.setItem('showBlockNumber', val)
})

watch(() => settings.showFiatValue, (val) => {
  localStorage.setItem('showFiatValue', val)
})

watch(() => settings.homePairs, (val) => {
  localStorage.setItem('homePairs', JSON.stringify(val))
}, { deep: true })

watch(() => settings.homeAssets, (val) => {
  localStorage.setItem('homeAssets', JSON.stringify(val))
}, { deep: true })

watch(() => settings.syncIndicator, (val) => {
  localStorage.setItem('syncIndicator', val)
})

watch(() => settings.employerMode, (val) => {
  localStorage.setItem('employerMode', val)
})

watch(() => settings.employerLabel, (val) => {
  localStorage.setItem('employerLabel', val)
})

watch(() => settings.merchantMode, (val) => {
  localStorage.setItem('merchantMode', val)
})

watch(() => settings.merchantLabel, (val) => {
  localStorage.setItem('merchantLabel', val)
})

watch(() => settings.merchantZeroConfThreshold, (val) => {
  localStorage.setItem('merchantZeroConfThreshold', val)
})

watch(() => settings.merchantRequiredConfirmations, (val) => {
  localStorage.setItem('merchantRequiredConfirmations', val)
})

watch(() => settings.dexMode, (val) => {
  localStorage.setItem('dexMode', val)
})

watch(() => settings.tradeMode, (val) => {
  localStorage.setItem('tradeMode', val)
})

watch(() => settings.chatMode, (val) => {
  localStorage.setItem('chatMode', val)
})

watch(() => settings.chatPeers, (val) => {
  localStorage.setItem('chatPeers', val)
})

watch(() => settings.chatNetwork, (val) => {
  localStorage.setItem('chatNetwork', val)
})

watch(() => settings.chatNickname, (val) => {
  localStorage.setItem('chatNickname', val)
})

watch(() => settings.faucetUrl, (val) => {
  localStorage.setItem('faucetUrl', val)
})

watch(() => settings.unlockDuration, (val) => {
  localStorage.setItem('unlockDuration', val)
  if (val === 'off') forgetAllPasswords()
})

watch(() => settings.autoOpenLastWallet, (val) => {
  localStorage.setItem('autoOpenLastWallet', val)
})

watch(() => settings.evmNetwork, (val) => {
  localStorage.setItem('evmNetwork', val)
})

watch(() => settings.slippageBps, (val) => {
  localStorage.setItem('slippageBps', val)
})

watch(() => settings.txDeadlineMin, (val) => {
  localStorage.setItem('txDeadlineMin', val)
})

watch(() => settings.theme, (val) => {
  localStorage.setItem('theme', val)
  applyTheme(val)
})

// Tema uygulama fonksiyonu
export function applyTheme(theme) {
  document.documentElement.classList.remove('dark')

  let isDark = false

  if (theme === 'device') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  } else if (theme === 'dark') {
    isDark = true
  }

  if (isDark) {
    document.documentElement.classList.add('dark')
  }

  // Sistem çubukları: önce temanın genel rengi (anında), ardından sayfanın
  // gerçek arka planı. Gecikme, arka planlardaki 300ms'lik renk geçişinin
  // bitmesini beklemek için — geçiş sırasında okunan renk ara bir tondur.
  setSystemBarColors(isDark ? '#1f2630' : '#f9fafb', { darkIcons: !isDark })
  clearTimeout(systemBarSyncTimer)
  systemBarSyncTimer = setTimeout(syncSystemBarsToPage, 350)
}

let systemBarSyncTimer = null

// Sistem tema değişikliklerini dinle
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

mediaQuery.addEventListener('change', () => {
  if (settings.theme === 'device') {
    applyTheme('device')
  }
})

// Sayfa yüklendiğinde temayı uygula
applyTheme(settings.theme)