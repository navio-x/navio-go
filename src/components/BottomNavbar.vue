<template>
  <nav
    ref="navRef"
    class="w-full z-[100]
           flex items-center
           px-3 gap-1 pt-3
           backdrop-blur-lg border-t
           transition-all duration-300
           bg-gradient-to-t from-[rgba(249,250,251,0.98)] to-[rgba(249,250,251,0.95)]
           dark:bg-gradient-to-t dark:from-[rgba(31,38,48,0.98)] dark:to-[rgba(31,38,48,0.95)]
           border-black/10 dark:border-white/5"
    :style="{ paddingBottom: isIos ? 'env(safe-area-inset-bottom)' : '0.75rem' }"
  >
    <!-- Sliding pill -->
    <div
      class="absolute rounded-xl bg-blue-600/10 dark:bg-blue-400/15 pointer-events-none"
      :style="pillStyle"
    />

    <router-link
      v-for="(item, index) in fixedNavItems"
      :key="item.name"
      :to="item.path"
      :ref="el => { buttonRefs[index] = el }"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl relative min-w-0 transition-colors duration-300"
      :class="route.path === item.path
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-black/50 dark:text-white/50'"
    >
      <component :is="item.icon" class="w-[22px] h-[22px]" :stroke-width="route.path === item.path ? 2.25 : 1.75" />
      <span
        class="max-w-full px-0.5 text-[10px] leading-tight truncate"
        :class="route.path === item.path ? 'font-semibold' : 'font-medium'"
      >{{ $t(item.labelKey) }}</span>
    </router-link>

    <button
      type="button"
      :ref="el => { buttonRefs[fixedNavItems.length] = el }"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl relative min-w-0 transition-colors duration-300"
      :class="isMoreActive
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-black/50 dark:text-white/50'"
      @click="showMore = true"
    >
      <MoreHorizontal class="w-[22px] h-[22px]" :stroke-width="isMoreActive ? 2.25 : 1.75" />
      <span
        class="max-w-full px-0.5 text-[10px] leading-tight truncate"
        :class="isMoreActive ? 'font-semibold' : 'font-medium'"
      >{{ $t('nav.more') }}</span>
    </button>
  </nav>

  <!-- More overflow sheet -->
  <div
    v-if="showMore"
    class="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
    @click.self="showMore = false"
  >
    <div
      class="bg-white dark:bg-gh-900 border-t border-gray-100 dark:border-gh-800 rounded-t-2xl p-3 w-full max-w-md shadow-2xl"
      :style="{ paddingBottom: isIos ? 'calc(env(safe-area-inset-bottom) + 0.75rem)' : '0.75rem' }"
    >
      <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gh-700 mx-auto mb-2" />
      <button
        v-for="item in overflowItems"
        :key="item.name"
        type="button"
        class="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left
               hover:bg-gray-50 dark:hover:bg-gh-800 transition-colors"
        @click="goTo(item.path)"
      >
        <component
          :is="item.icon"
          class="w-5 h-5 shrink-0"
          :class="isOverflowItemActive(item)
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-black/60 dark:text-white/60'"
        />
        <span
          class="text-sm font-medium"
          :class="isOverflowItemActive(item)
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-700 dark:text-gray-300'"
        >
          {{ $t(item.labelKey) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Wallet, ArrowDownLeft, ArrowUpRight, Layers, History, Settings, Briefcase, Store, Repeat, ArrowLeftRight, MessageCircle, MoreHorizontal, CandlestickChart } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'
import { settings } from '@/stores/settings'

const isIosNative = Capacitor.getPlatform() === 'ios'
const isIosPwa = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream && window.navigator.standalone === true
const isIos = isIosNative || isIosPwa

const route = useRoute()
const router = useRouter()
const navRef = ref(null)
const buttonRefs = ref([])
const showMore = ref(false)

// The bar holds the high-frequency actions — home, receive, send, swap,
// history — plus one "More" slot. Everything else — including future
// optional modes — lives in the More sheet below, in a fixed manifest
// order that never depends on which toggle was turned on first.
const fixedNavItems = computed(() => [
  { name: 'wallet',  path: '/wallet/balance', icon: Wallet,  labelKey: 'wallet.home' },
  { name: 'receive', path: '/wallet/receive', icon: ArrowDownLeft, labelKey: 'wallet.receive' },
  { name: 'send',    path: '/wallet/send',    icon: ArrowUpRight, labelKey: 'wallet.send' },
  ...(settings.dexMode ? [{ name: 'swap', path: '/swap', icon: Repeat, labelKey: 'swap.title' }] : []),
  { name: 'history', path: '/wallet/history', icon: History, labelKey: 'wallet.history' },
])

const overflowManifest = [
  { name: 'assets',   path: '/wallet/assets', icon: Layers,    labelKey: 'assets.title' },
  { name: 'payroll',  path: '/payroll',       icon: Briefcase, labelKey: 'payroll.title',  enabled: () => settings.employerMode },
  { name: 'pos',      path: '/pos',           icon: Store,     labelKey: 'pos.title',      enabled: () => settings.merchantMode },
  { name: 'dex',      path: '/dex',           icon: CandlestickChart, labelKey: 'dex.title', enabled: () => settings.dexMode },
  { name: 'trade',    path: '/trade',         icon: ArrowLeftRight, labelKey: 'trade.title', enabled: () => settings.tradeMode },
  { name: 'chat',     path: '/chat',          icon: MessageCircle, labelKey: 'chat.title',  enabled: () => settings.chatMode },
  { name: 'settings', path: '/settings',      icon: Settings,  labelKey: 'settings.title' },
]

const overflowItems = computed(() => overflowManifest.filter(item => !item.enabled || item.enabled()))

const isOverflowItemActive = (item) =>
  route.path === item.path || route.path.startsWith(item.path + '/')

const isMoreActive = computed(() => overflowItems.value.some(isOverflowItemActive))

const goTo = (path) => {
  showMore.value = false
  router.push(path)
}

const pillStyle = ref({ opacity: 0 })

const updatePill = async () => {
  await nextTick()
  let activeIdx = fixedNavItems.value.findIndex(item => route.path === item.path)
  if (activeIdx === -1 && isMoreActive.value) activeIdx = fixedNavItems.value.length
  if (activeIdx === -1) {
    pillStyle.value = { ...pillStyle.value, opacity: 0 }
    return
  }

  const el = buttonRefs.value[activeIdx]
  const btn = el?.$el ?? el
  const nav = navRef.value
  if (!btn || !nav) return

  const btnRect = btn.getBoundingClientRect()
  const navRect = nav.getBoundingClientRect()

  pillStyle.value = {
    left:    `${btnRect.left - navRect.left}px`,
    top:     `${btnRect.top  - navRect.top}px`,
    width:   `${btnRect.width}px`,
    height:  `${btnRect.height}px`,
    opacity: 1,
    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s',
  }
}

watch(() => route.path, updatePill)
watch(() => settings.employerMode, updatePill)
watch(() => settings.merchantMode, updatePill)
watch(() => settings.dexMode, updatePill)
watch(() => settings.tradeMode, updatePill)
watch(() => settings.chatMode, updatePill)
// The pill is positioned from measured pixels, so it has to be re-measured
// whenever the bar itself changes size (window resize, rotation, styles or
// fonts arriving after mount) — not only on route changes.
let navResizeObserver = null
onMounted(() => {
  updatePill()
  if (typeof ResizeObserver !== 'undefined' && navRef.value) {
    navResizeObserver = new ResizeObserver(updatePill)
    navResizeObserver.observe(navRef.value)
  }
})
onUnmounted(() => navResizeObserver?.disconnect())
</script>
