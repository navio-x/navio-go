<template>
  <nav
    ref="navRef"
    class="w-full z-[100]
           flex items-center
           px-0 pt-3
           backdrop-blur-lg border-t
           transition-all duration-300
           bg-gradient-to-t from-[rgba(255,255,255,0.98)] to-[rgba(255,255,255,0.95)]
           dark:bg-gradient-to-t dark:from-[rgba(30,35,41,0.98)] dark:to-[rgba(30,35,41,0.95)]
           border-black/10 dark:border-white/5"
    :style="{ paddingBottom: isIos ? 'env(safe-area-inset-bottom)' : '0.75rem' }"
  >
    <!-- Sliding pill -->
    <div
      class="absolute rounded-xl bg-black/5 dark:bg-white/8 pointer-events-none"
      :style="pillStyle"
    />

    <router-link
      v-for="(item, index) in fixedNavItems"
      :key="item.name"
      :to="item.path"
      :ref="el => { buttonRefs[index] = el }"
      class="flex-1 flex items-center justify-center py-3 rounded-xl relative min-w-0"
    >
      <component
        :is="item.icon"
        class="w-6 h-6 transition-colors duration-300"
        :class="route.path === item.path
          ? 'text-[#00cc6a] dark:text-[#00ff88]'
          : 'text-black/50 dark:text-white/50'"
      />
    </router-link>

    <button
      type="button"
      :ref="el => { buttonRefs[fixedNavItems.length] = el }"
      class="flex-1 flex items-center justify-center py-3 rounded-xl relative min-w-0"
      :aria-label="$t('nav.more')"
      @click="showMore = true"
    >
      <MoreHorizontal
        class="w-6 h-6 transition-colors duration-300"
        :class="isMoreActive
          ? 'text-[#00cc6a] dark:text-[#00ff88]'
          : 'text-black/50 dark:text-white/50'"
      />
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
            ? 'text-[#00cc6a] dark:text-[#00ff88]'
            : 'text-black/60 dark:text-white/60'"
        />
        <span
          class="text-sm font-medium"
          :class="isOverflowItemActive(item)
            ? 'text-[#00cc6a] dark:text-[#00ff88]'
            : 'text-gray-700 dark:text-gray-300'"
        >
          {{ $t(item.labelKey) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Wallet, Download, SendHorizontal, Layers, History, Settings, Briefcase, Store, Repeat, MoreHorizontal } from 'lucide-vue-next'
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

// The bar itself is capped at 5 slots: 4 fixed high-frequency actions plus
// one "More" slot. Everything else — including future optional modes —
// lives in the More sheet below, in a fixed manifest order that never
// depends on which toggle was turned on first.
const fixedNavItems = [
  { name: 'wallet',  path: '/wallet/balance', icon: Wallet },
  { name: 'receive', path: '/wallet/receive', icon: Download },
  { name: 'send',    path: '/wallet/send',    icon: SendHorizontal },
  { name: 'history', path: '/wallet/history', icon: History },
]

const overflowManifest = [
  { name: 'assets',   path: '/wallet/assets', icon: Layers,    labelKey: 'assets.title' },
  { name: 'payroll',  path: '/payroll',       icon: Briefcase, labelKey: 'payroll.title',  enabled: () => settings.employerMode },
  { name: 'pos',      path: '/pos',           icon: Store,     labelKey: 'pos.title',      enabled: () => settings.merchantMode },
  { name: 'dex',      path: '/dex',           icon: Repeat,    labelKey: 'dex.title',      enabled: () => settings.dexMode },
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
  let activeIdx = fixedNavItems.findIndex(item => route.path === item.path)
  if (activeIdx === -1 && isMoreActive.value) activeIdx = fixedNavItems.length
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
onMounted(updatePill)
</script>
