<template>
  <nav
    ref="navRef"
    class="fixed bottom-0 left-0 right-0 z-[100]
           flex justify-around items-center
           px-0 pt-3
           backdrop-blur-lg border-t
           transition-all duration-300
           bg-gradient-to-t from-[rgba(255,255,255,0.98)] to-[rgba(255,255,255,0.95)]
           dark:bg-gradient-to-t dark:from-[rgba(30,35,41,0.98)] dark:to-[rgba(30,35,41,0.95)]
           border-black/10 dark:border-white/5"
    :style="{ paddingBottom: isIos ? 'calc(0.75rem + env(safe-area-inset-bottom))' : '0.75rem' }"
  >
    <!-- Sliding pill -->
    <div
      class="absolute rounded-xl bg-black/5 dark:bg-white/8 pointer-events-none"
      :style="pillStyle"
    />

    <router-link
      v-for="(item, index) in navItems"
      :key="item.name"
      :to="item.path"
      :ref="el => { buttonRefs[index] = el }"
      class="flex items-center justify-center px-5 py-3 rounded-xl relative"
    >
      <component
        :is="item.icon"
        class="w-6 h-6 transition-colors duration-300"
        :class="isActive(item.path)
          ? 'text-[#00cc6a] dark:text-[#00ff88]'
          : 'text-black/50 dark:text-white/50'"
      />
    </router-link>
  </nav>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Wallet, Download, Upload, Repeat, Settings } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'

const isIos = Capacitor.getPlatform() === 'ios'

const route = useRoute()
const navRef = ref(null)
const buttonRefs = ref([])

const navItems = [
  { name: 'wallet',   path: '/wallet/balance', icon: Wallet },
  { name: 'receive',  path: '/wallet/receive',  icon: Download },
  { name: 'send',     path: '/wallet/send',     icon: Upload },
  { name: 'swap',     path: '/wallet/history',  icon: Repeat },
  { name: 'settings', path: '/settings',        icon: Settings },
]

const isActive = (path) => route.path === path

const pillStyle = ref({ opacity: 0 })

const updatePill = async () => {
  await nextTick()
  const activeIdx = navItems.findIndex(item => route.path === item.path)
  if (activeIdx === -1) return

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
onMounted(updatePill)
</script>
