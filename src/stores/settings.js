import { reactive, watch } from 'vue'
import { Capacitor, registerPlugin } from '@capacitor/core'

const SystemBars = registerPlugin('NavigationBar')

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
  // Off by default: opsiyonel BSC/EVM DEX katmanı. Kapalıyken menüde DEX
  // görünmez ve tek bir RPC çağrısı bile yapılmaz (bkz. stores/evm.js).
  dexMode:         localStorage.getItem('dexMode')         === 'true',
  // 56 = BSC Mainnet, 97 = BSC Testnet.
  evmNetwork:      Number(localStorage.getItem('evmNetwork') ?? 56),
  // Baz puan cinsinden slippage toleransı (100 = %1).
  slippageBps:     Number(localStorage.getItem('slippageBps') ?? 100),
  // Swap işlemi için dakika cinsinden deadline.
  txDeadlineMin:   Number(localStorage.getItem('txDeadlineMin') ?? 5),
})

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

  if (Capacitor.isNativePlatform()) {
    const statusColor = isDark ? '#1e2329' : '#ffffff'
    const navColor    = isDark ? '#1e2329' : '#ffffff'
    SystemBars.setStatusBarColor({ color: statusColor, darkIcons: !isDark }).catch(() => {})
    SystemBars.setColor({ color: navColor, darkButtons: !isDark }).catch(() => {})
  }
}

// Sistem tema değişikliklerini dinle
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

mediaQuery.addEventListener('change', () => {
  if (settings.theme === 'device') {
    applyTheme('device')
  }
})

// Sayfa yüklendiğinde temayı uygula
applyTheme(settings.theme)