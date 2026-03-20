<template>
  <div
    class="p-6 min-h-screen bg-white text-gray-900 dark:bg-gh-900 dark:text-white transition-colors duration-300"
  >
    <!-- Beta / Testnet Risk Warning -->
    <div class="mb-6 rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
        </svg>
        <span class="font-bold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wide">
          {{ $t('agreement.betaBadge') }}
        </span>
      </div>
      <p class="text-sm font-semibold text-amber-800 dark:text-amber-300 leading-snug">
        {{ $t('agreement.betaWarningTitle') }}
      </p>
      <ul class="text-sm text-amber-700 dark:text-amber-400 space-y-1.5 list-none">
        <li class="flex items-start gap-2">
          <span class="mt-0.5 shrink-0">⚠</span>
          <span>{{ $t('agreement.betaPoint1') }}</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-0.5 shrink-0">⚠</span>
          <span>{{ $t('agreement.betaPoint2') }}</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-0.5 shrink-0">⚠</span>
          <span>{{ $t('agreement.betaPoint3') }}</span>
        </li>
      </ul>
    </div>

    <h2 class="text-xl font-bold mb-4">
      {{ $t('agreement.title') }}
    </h2>

    <div class="space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
      <p>
        {{ $t('agreement.description') }}
      </p>

      <p>
        {{ $t('agreement.nonCustodial') }}
        <strong>{{ $t('agreement.noAccess') }}</strong>
      </p>

      <p>
        {{ $t('agreement.responsibility') }}
      </p>

      <p>
        {{ $t('agreement.notFinancial') }}
      </p>

      <p>
        {{ $t('agreement.blockchain') }}
      </p>

      <p>
        {{ $t('agreement.liability') }}
      </p>

      <p class="font-medium">
        {{ $t('agreement.acceptTerms') }}
      </p>
    </div>

    <div class="mt-8">
      <WizardNav
        :showBack="false"
        :showNext="true"
        nextRoute="/wallet/home"
        :nextTitle="$t('agreement.accept')"
      />
    </div>
  </div>
</template>

<script setup>
import WizardNav from "@/components/WizardNav.vue";
</script>
