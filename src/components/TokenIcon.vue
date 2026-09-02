<template>
  <div
    class="shrink-0 rounded-full overflow-hidden bg-gray-100 dark:bg-gh-700 flex items-center justify-center"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <template v-if="lightIcon">
      <img :src="lightIcon" :alt="symbol" :class="[iconFitClass, { 'dark:hidden': !!darkIcon }]" />
      <img v-if="darkIcon" :src="darkIcon" :alt="symbol" :class="[iconFitClass, 'hidden dark:block']" />
    </template>
    <span
      v-else
      class="font-semibold text-gray-500 dark:text-gray-300 leading-none"
      :style="{ fontSize: Math.round(size * 0.4) + 'px' }"
    >
      {{ initials }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Token ikonları evm-networks.json'daki `logo` alanından, dosya adıyla
// çözülür — sembole göre değil. Bu bilinçli bir güvenlik kararı: kullanıcının
// eklediği özel bir token (`custom: true`) hiçbir zaman `logo` alanına sahip
// olmaz (bkz. DexView.vue confirmAddToken), bu yüzden biri "USDT" sembollü
// sahte bir token eklese bile gerçek USDT logosunu asla alamaz — jenerik baş
// harf rozetiyle kalır. `custom` prop'u burada ek bir güvenlik katmanı.
// NOT: import.meta.glob burada "@" alias'ını kabul etmez — Vite bu
// pattern'i alias çözümlenmeden önce statik olarak analiz eder, bu yüzden
// göreli yol (bu dosyanın kendi konumuna göre) kullanılmak zorunda.
const iconModules = import.meta.glob('../assets/tokens/*', { eager: true, import: 'default' })

function resolveIcon(filename) {
  if (!filename) return null
  const entry = Object.entries(iconModules).find(([path]) => path.endsWith('/' + filename))
  return entry ? entry[1] : null
}

const props = defineProps({
  symbol: { type: String, required: true },
  logo: { type: String, default: null },
  custom: { type: Boolean, default: false },
  size: { type: Number, default: 28 },
})

const lightIcon = computed(() => (props.custom ? null : resolveIcon(props.logo)))
// Konvansiyon: "<isim>-light.<uzantı>" için varsa "<isim>-dark.<uzantı>"
// sibling'i aranır (bkz. wnav-light.svg / wnav-dark.svg). Bulunamazsa tek
// ikon her iki temada da aynen kullanılır (wbnb/usdt/busd gibi).
const darkIcon = computed(() => {
  if (props.custom || !props.logo || !props.logo.includes('-light.')) return null
  return resolveIcon(props.logo.replace('-light.', '-dark.'))
})

const initials = computed(() => (props.symbol || '?').slice(0, 2).toUpperCase())

// wbnb/usdt/busd .webp'leri kenara kadar dolu daire rozetler — object-cover
// ile tam kaplıyor. wnav-*.svg gibi vektör işaretler ise kendi arka planı
// olmayan düz bir marka; aynı şekilde kaplatılırsa daireyi taşırıp
// olduğundan büyük görünüyordu. SVG'ler için %30 küçültülüp (70% boyut)
// içeride ortalanacak şekilde object-contain kullanılır.
const iconFitClass = computed(() =>
  props.logo?.endsWith('.svg') ? 'w-[70%] h-[70%] object-contain' : 'w-full h-full object-cover'
)
</script>
