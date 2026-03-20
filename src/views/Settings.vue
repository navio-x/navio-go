<template>
  <div class="p-5 space-y-5 bg-white text-gray-900 dark:bg-gh-900 dark:text-white min-h-screen pb-24 transition-colors duration-300">
    <h2 class="text-xl font-bold tracking-tight">{{ $t('settings.title') }}</h2>
    <SettingsPanel />
  </div>
</template>

<script setup>
import SettingsPanel from '../components/Settings.vue'
</script>
