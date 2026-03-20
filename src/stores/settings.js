import { reactive, watch } from 'vue'
import { Capacitor, registerPlugin } from '@capacitor/core'

const SystemBars = registerPlugin('NavigationBar')

export const settings = reactive({
  language:        localStorage.getItem('language')        || 'en',
  currency:        localStorage.getItem('currency')        || 'USD',
  theme:           localStorage.getItem('theme')           || 'device',
  wallpaper:       localStorage.getItem('wallpaper')       || 'default',
  showBlockNumber: localStorage.getItem('showBlockNumber') !== 'false',
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