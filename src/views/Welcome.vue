<!-- Welcome.vue — first-run intro: the logo slide, then one swipeable slide
     per opt-in feature (each with its own on/off switch, the same setting
     Settings exposes). Only reachable before the agreement is accepted. -->
<template>
  <div
    class="min-h-screen flex flex-col
           bg-white text-gray-900
           dark:bg-gh-900 dark:text-white
           transition-colors duration-300"
  >
    <div class="flex items-center justify-between p-4">
      <button
        @click="finish"
        class="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-800 transition-colors"
      >
        {{ $t('welcome.skip') }}
      </button>
      <LanguageSwitcher />
    </div>

    <!-- Slides: native horizontal scroll-snap, so swiping just works -->
    <div
      ref="scroller"
      @scroll.passive="onScroll"
      class="slides flex-1 flex overflow-x-auto snap-x snap-mandatory"
    >
      <section class="w-full shrink-0 snap-center flex flex-col items-center justify-center text-center px-8 space-y-4">
        <img src="@/assets/navio-symbol-light.svg" class="w-32 h-32 mx-auto block dark:hidden" alt="Navio Go Logo" />
        <img src="@/assets/navio-symbol-dark.svg" class="w-32 h-32 mx-auto hidden dark:block" alt="Navio Go Logo" />
        <h1 class="text-3xl font-bold">{{ $t('welcome.title') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 tracking-wide">{{ $t('welcome.tagline') }}</p>
        <p class="text-xs text-gray-400 pt-2">{{ $t('welcome.sovereignty') }}</p>
      </section>

      <section
        v-for="f in FEATURES"
        :key="f.id"
        class="w-full shrink-0 snap-center flex flex-col items-center justify-center text-center px-8"
      >
        <div class="w-28 h-28 rounded-3xl flex items-center justify-center bg-gradient-to-br from-[#ec1ec6] to-[#1d8ff9] shadow-lg">
          <component :is="f.icon" class="w-14 h-14 text-white" :stroke-width="1.5" />
        </div>
        <h2 class="mt-8 text-2xl font-bold">{{ $t(`welcome.features.${f.id}.title`) }}</h2>
        <p class="mt-3 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {{ $t(`welcome.features.${f.id}.desc`) }}
        </p>

        <div class="mt-8 w-full max-w-xs rounded-2xl border border-gray-200 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-3">
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ $t('welcome.enable') }}</span>
          <button
            type="button"
            role="switch"
            :aria-checked="settings[f.setting]"
            :aria-label="$t(`welcome.features.${f.id}.title`)"
            @click="settings[f.setting] = !settings[f.setting]"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
            :class="settings[f.setting] ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gh-600'"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              :class="settings[f.setting] ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
        <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">{{ $t('welcome.enableHint') }}</p>
      </section>
    </div>

    <div class="p-6 space-y-5">
      <div class="flex justify-center gap-2">
        <button
          v-for="i in slideCount"
          :key="i"
          @click="goTo(i - 1)"
          :aria-label="`${i} / ${slideCount}`"
          :aria-current="active === i - 1"
          class="h-1.5 rounded-full transition-all"
          :class="active === i - 1 ? 'w-5 bg-blue-600 dark:bg-blue-500' : 'w-1.5 bg-gray-300 dark:bg-gh-600'"
        />
      </div>

      <button
        @click="isLast ? finish() : goTo(active + 1)"
        class="w-full py-3 rounded-xl text-sm font-semibold transition text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
      >
        {{ isLast ? $t('welcome.getStarted') : $t('common.next') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { ChartCandlestick, Store, HandCoins, MessageSquareLock } from "lucide-vue-next";
import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
import { settings } from "@/stores/settings";

const router = useRouter();

// `setting` is the settings.js flag the slide's switch flips.
const FEATURES = [
  { id: "dex", icon: ChartCandlestick, setting: "dexMode" },
  { id: "merchant", icon: Store, setting: "merchantMode" },
  { id: "payroll", icon: HandCoins, setting: "employerMode" },
  { id: "chat", icon: MessageSquareLock, setting: "chatMode" },
];
const slideCount = FEATURES.length + 1;

const scroller = ref(null);
const active = ref(0);
const isLast = computed(() => active.value === slideCount - 1);

function onScroll() {
  const el = scroller.value;
  if (el?.clientWidth) active.value = Math.round(el.scrollLeft / el.clientWidth);
}

function goTo(index) {
  const el = scroller.value;
  if (!el) return;
  el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
}

function finish() {
  router.push("/agreement");
}
</script>

<style scoped>
.slides {
  scrollbar-width: none;
}
.slides::-webkit-scrollbar {
  display: none;
}
</style>
