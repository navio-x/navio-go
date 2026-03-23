<!-- Welcome.vue -->
<template>
  <div
    class="relative min-h-screen flex items-center justify-center
           bg-white text-gray-900
           dark:bg-gh-900 dark:text-white
           transition-colors duration-300"
  >
    <!-- Dil Değiştirici - Sağ Üst Köşe -->
    <div class="absolute top-4 right-4">
      <LanguageSwitcher />
    </div>

    <div class="text-center space-y-4">
      <img src="@/assets/navio-symbol-light.svg" class="w-32 h-32 mx-auto block dark:hidden" alt="Navio Go Logo" />
      <img src="@/assets/navio-symbol-dark.svg" class="w-32 h-32 mx-auto hidden dark:block" alt="Navio Go Logo" />

      <h1 class="text-3xl font-bold">
        {{ $t('welcome.title') }}
      </h1>

      <p class="text-sm text-gray-500 dark:text-gray-400 tracking-wide">
        {{ $t('welcome.tagline') }}
      </p>

      <WizardNav
        :showBack="false"
        :showNext="true"
        nextRoute="/agreement"
        :nextTitle="$t('welcome.getStarted')"
      />

      <p class="text-xs text-gray-400 pt-2">
        {{ $t('welcome.sovereignty') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import WizardNav from "@/components/WizardNav.vue";
import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
</script>
