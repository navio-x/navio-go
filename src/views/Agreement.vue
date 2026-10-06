<template>
  <div
    class="p-6 min-h-screen bg-white text-gray-900 dark:bg-gh-900 dark:text-white transition-colors duration-300"
  >
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
