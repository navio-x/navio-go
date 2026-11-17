<template>
  <!-- Same screen WalletHome shows while it auto-opens a wallet (and then
       asks for its password), so the hand-over between the two routes is
       invisible: same layout, same spinner, same wallet name. -->
  <StartupScreen
    v-if="status !== 'error'"
    busy
    :title="autoOpenName"
    :subtitle="$t('walletList.loading')"
  />
</template>
<script setup>
  import { ref, onMounted } from "vue";
  import { useRouter } from "vue-router";
  import StartupScreen from "@/components/StartupScreen.vue";
  import { nextPaint } from "@/lib/nextPaint";
  import { initNavioSDK, LAST_WALLET_KEY } from "../stores/navio";
  import { getAllWallets } from "@/stores/wallet_management";
  import { settings } from "@/stores/settings";
  const status = ref("loading");
  const router = useRouter();

  // The wallet WalletHome is about to auto-open, if any — mirrors its
  // findAutoOpenWallet() so the name is already on screen before the switch.
  function predictAutoOpenName() {
    if (!localStorage.getItem('user_agreement_accepted') || !settings.autoOpenLastWallet) return "";
    const last = localStorage.getItem(LAST_WALLET_KEY);
    return getAllWallets().some((w) => w.name === last) ? last : "";
  }
  const autoOpenName = predictAutoOpenName();

  onMounted(async () => {
    try
    {
      // Paint the loader first: the SDK/WASM init blocks the main thread.
      await nextPaint();
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
