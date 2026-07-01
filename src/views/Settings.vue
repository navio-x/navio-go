<template>
  <div class="p-5 bg-gray-50 dark:bg-gh-900 pb-6 transition-colors duration-300">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('settings.title') }}</h1>
    <SettingsPanel />
  </div>
</template>

<script setup>
import SettingsPanel from '../components/Settings.vue'
</script>
