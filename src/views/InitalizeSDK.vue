<template>
  <div class="min-h-screen flex items-center justify-center bg-white text-gray-900 dark:bg-gh-950 dark:text-white transition-colors duration-300">
    <div class="text-center space-y-4">

      <!-- Loading Animasyonu -->
      <div v-if="status === 'loading'" class="flex flex-col items-center space-y-2">
        <!-- Spinner -->
        <div class="w-12 h-12 border-4 border-gray-300 dark:border-gh-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
        <p class="text-gray-900 dark:text-white">{{ $t('common.pleaseWait') }}</p>
      </div>

    </div>
  </div>
</template>
<script setup>
  import { ref, onMounted } from "vue";
  import { useRouter } from "vue-router";
  import { initNavioSDK } from "../stores/navio";
  const status = ref("loading");
  const router = useRouter();
  onMounted(async () => {
    try
    {
      await initNavioSDK();
      status.value = "success";
        if (localStorage.getItem('user_agreement_accepted'))
        {
          router.push("/wallet/home");   
        }

      else
        {
          router.push("/welcome");    
        }
    }
    catch (e)
    {
      console.error(e);
      status.value = "error";
    }
  });
</script>