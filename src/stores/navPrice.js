import { reactive } from 'vue'

// Supported fiat currencies (all available on frankfurter.app)
export const FIAT_CURRENCIES = [
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'TRY', label: 'TRY – Turkish Lira' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'JPY', label: 'JPY – Japanese Yen' },
  { value: 'CNY', label: 'CNY – Chinese Yuan' },
  { value: 'KRW', label: 'KRW – South Korean Won' },
  { value: 'BRL', label: 'BRL – Brazilian Real' },
  { value: 'CAD', label: 'CAD – Canadian Dollar' },
  { value: 'AUD', label: 'AUD – Australian Dollar' },
  { value: 'CHF', label: 'CHF – Swiss Franc' },
  { value: 'INR', label: 'INR – Indian Rupee' },
]

const FX_TARGETS = FIAT_CURRENCIES.filter(c => c.value !== 'USD').map(c => c.value).join(',')

export const navPrice = reactive({
  usd:      null,
  change24h: null,
  rates:    { USD: 1 }, // rates relative to USD
  loading:  false,
  error:    false,
})

let _timer = null

export async function fetchNavPrice() {
  if (navPrice.loading) return
  navPrice.loading = true
  navPrice.error = false

  try {
    const priceRes  = await fetch('https://blocks.nav.io/api/price')
    const priceData = await priceRes.json()
    navPrice.usd       = priceData.price_usd      ?? null
    navPrice.change24h = priceData.change_24h_pct ?? null
  } catch {
    navPrice.error = true
  }

  try {
    const fxRes  = await fetch(`https://api.frankfurter.dev/v1/latest?from=USD&to=${FX_TARGETS}`)
    const fxData = await fxRes.json()
    navPrice.rates = { USD: 1, ...(fxData.rates ?? {}) }
  } catch {
    navPrice.rates = { USD: 1 }
  }

  navPrice.loading = false
}

export function getPriceIn(currency) {
  if (navPrice.usd == null) return null
  const rate = navPrice.rates[currency] ?? null
  if (rate == null) return null
  return navPrice.usd * rate
}

export function startPricePolling(intervalMs = 60_000) {
  fetchNavPrice()
  _timer = setInterval(fetchNavPrice, intervalMs)
}

export function stopPricePolling() {
  if (_timer) { clearInterval(_timer); _timer = null }
}
