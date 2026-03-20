<template>
  <div class="language-switcher">
    <select
      v-model="currentLocale"
      @change="changeLanguage"
      class="px-3 py-2 rounded-lg text-sm font-medium
             bg-gray-100 dark:bg-gh-800
             text-gray-900 dark:text-white
             border border-gray-200 dark:border-gh-700
             hover:bg-gray-200 dark:hover:bg-gh-700
             transition-colors duration-200 cursor-pointer outline-none"
    >
      <option value="en">English</option>
      <option value="tr">Türkçe</option>
      <option value="zh">中文</option>
      <option value="ru">Русский</option>
      <option value="es">Español</option>
      <option value="pt-BR">Português (BR)</option>
      <option value="ko">한국어</option>
      <option value="de">Deutsch</option>
      <option value="fr">Français</option>
      <option value="ja">日本語</option>
    </select>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
const currentLocale = ref(locale.value)

const changeLanguage = () => {
  locale.value = currentLocale.value
  localStorage.setItem('language', currentLocale.value)
}
</script>

<style scoped>
.language-switcher {
  display: inline-block;
}
</style>