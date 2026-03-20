import { createI18n } from 'vue-i18n'
import tr from './locales/tr.json'
import en from './locales/en.json'
import zh from './locales/zh.json'
import ru from './locales/ru.json'
import es from './locales/es.json'
import ptBR from './locales/pt-BR.json'
import ko from './locales/ko.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'

const supportedLocales = ['tr', 'en', 'zh', 'ru', 'es', 'pt-BR', 'ko', 'de', 'fr', 'ja']

// Tarayıcı dilini al veya varsayılan olarak EN kullan
const getBrowserLanguage = () => {
  const savedLanguage = localStorage.getItem('language')
  if (savedLanguage) {
    return savedLanguage
  }

  const browserLang = navigator.language
  if (supportedLocales.includes(browserLang)) return browserLang

  const shortLang = browserLang.split('-')[0]
  return supportedLocales.includes(shortLang) ? shortLang : 'en'
}

const i18n = createI18n({
  legacy: false, // Composition API kullanımı için
  locale: getBrowserLanguage(),
  fallbackLocale: 'en',
  messages: {
    tr,
    en,
    zh,
    ru,
    es,
    'pt-BR': ptBR,
    ko,
    de,
    fr,
    ja
  },
  globalInjection: true // $t'yi global olarak kullanabilmek için
})

export default i18n
