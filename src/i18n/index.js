import { createI18n } from 'vue-i18n'
import en from './locales/en.json'

// English is the fallback and ships with the app; every other language is
// its own chunk, fetched the first time it is chosen. The ten locale files
// together are about 1 MB — bundling them all put the main chunk past the
// service worker's 2 MiB precache limit.
const loaders = import.meta.glob('./locales/*.json')

export const supportedLocales = ['tr', 'en', 'zh', 'ru', 'es', 'pt-BR', 'ko', 'de', 'fr', 'ja']

// Tarayıcı dilini al veya varsayılan olarak EN kullan
export const getBrowserLanguage = () => {
  const savedLanguage = localStorage.getItem('language')
  if (savedLanguage && supportedLocales.includes(savedLanguage)) {
    return savedLanguage
  }

  const browserLang = navigator.language
  if (supportedLocales.includes(browserLang)) return browserLang

  const shortLang = browserLang.split('-')[0]
  return supportedLocales.includes(shortLang) ? shortLang : 'en'
}

const i18n = createI18n({
  legacy: false, // Composition API kullanımı için
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
  globalInjection: true // $t'yi global olarak kullanabilmek için
})

const loaded = new Set(['en'])

/** Fetches a language's messages (once) so it can be switched to without a flash of English. */
export async function loadLocale(lang) {
  if (loaded.has(lang)) return
  const load = loaders[`./locales/${lang}.json`]
  if (!load) return
  const messages = (await load()).default
  i18n.global.setLocaleMessage(lang, messages)
  loaded.add(lang)
}

/** Loads `lang` if needed and makes it the active language. */
export async function setLanguage(lang) {
  if (!supportedLocales.includes(lang)) lang = 'en'
  await loadLocale(lang)
  i18n.global.locale.value = lang
}

export default i18n
