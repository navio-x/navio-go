<!-- Saved Hyperliquid/Arbitrum send destinations: pick one to fill the
     withdraw form, or add / rename / re-network / delete entries. Only
     entries for `networks` (the routes the current asset can use) show. -->
<template>
  <BottomSheet :open="open" :title="form ? $t(form.id ? 'addressBook.editTitle' : 'addressBook.addTitle') : $t('addressBook.title')" @close="close">
    <!-- Add / edit form -->
    <div v-if="form" class="space-y-3">
      <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3">
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('addressBook.label') }}</p>
        <input
          v-model="form.label"
          type="text"
          maxlength="40"
          :placeholder="$t('addressBook.labelPlaceholder')"
          class="w-full bg-transparent text-sm text-gray-900 dark:text-white outline-none"
        />
      </div>
      <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3">
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('hlAsset.recipient') }}</p>
        <input
          v-model.trim="form.address"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="0x…"
          class="w-full bg-transparent font-mono text-sm text-gray-900 dark:text-white outline-none"
        />
      </div>
      <p v-if="formChecksum" class="-mt-1 text-xs text-gray-500 dark:text-gray-400">
        {{ $t('addressBook.checksumNote') }}
        <span class="block font-mono text-[11px] break-all">{{ formChecksum }}</span>
      </p>
      <div>
        <p class="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('hlAsset.network') }}</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="n in EVM_ADDRESS_NETWORKS"
            :key="n"
            @click="form.network = n"
            class="rounded-xl border px-3 py-2 text-sm font-semibold transition-colors"
            :class="form.network === n
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-white'
              : 'border-gray-200 dark:border-gh-600 text-gray-600 dark:text-gray-300'"
          >
            {{ $t('hlAsset.routes.' + n + '.name') }}
          </button>
        </div>
      </div>
      <p v-if="formError" class="text-xs text-red-600 dark:text-red-400">{{ $t('addressBook.errors.' + formError) }}</p>
      <div class="flex gap-2 pt-1">
        <button
          @click="form = null"
          class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="submitForm"
          :disabled="saving"
          class="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {{ $t('addressBook.save') }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div v-else class="space-y-3">
      <div v-if="networks.length > 1" class="flex gap-2">
        <button
          v-for="f in ['all', ...networks]"
          :key="f"
          @click="filter = f"
          class="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
          :class="filter === f
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gh-800 text-gray-600 dark:text-gray-300'"
        >
          {{ f === 'all' ? $t('addressBook.all') : $t('hlAsset.routes.' + f + '.name') }}
        </button>
      </div>

      <p v-if="loadError" class="text-xs text-red-600 dark:text-red-400">{{ $t('addressBook.errors.' + loadError) }}</p>
      <div v-else-if="loading" class="py-6 flex justify-center"><Loader2 class="w-5 h-5 animate-spin text-gray-400" /></div>
      <p v-else-if="!visible.length" class="py-6 text-center text-sm text-gray-400 dark:text-gray-500">{{ $t('addressBook.empty') }}</p>

      <ul v-else class="space-y-2">
        <li
          v-for="e in visible"
          :key="e.id"
          class="rounded-xl border border-gray-200 dark:border-gh-700 p-3"
        >
          <div v-if="pendingDelete === e.id" class="flex items-center gap-2">
            <p class="flex-1 text-xs text-gray-700 dark:text-gray-300">{{ $t('addressBook.deleteConfirm', { label: e.label }) }}</p>
            <button @click="pendingDelete = null" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300">{{ $t('common.cancel') }}</button>
            <button @click="remove(e)" class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700">{{ $t('addressBook.delete') }}</button>
          </div>
          <div v-else class="flex items-center gap-2">
            <button @click="pick(e)" class="flex-1 min-w-0 text-left">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ e.label }}</span>
                <span
                  class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                  :class="e.network === 'arbitrum'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'"
                >
                  {{ $t('hlAsset.routes.' + e.network + '.name') }}
                </span>
              </div>
              <p class="font-mono text-[11px] text-gray-500 dark:text-gray-400 truncate">{{ e.address }}</p>
            </button>
            <button @click="startEdit(e)" class="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-800" :aria-label="$t('addressBook.edit')">
              <Pencil class="w-4 h-4" />
            </button>
            <button @click="pendingDelete = e.id" class="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-800" :aria-label="$t('addressBook.delete')">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </li>
      </ul>

      <button
        @click="startAdd"
        class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-dashed border-gray-300 dark:border-gh-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-800"
      >
        <Plus class="w-4 h-4" />
        {{ $t('addressBook.add') }}
      </button>
    </div>
  </BottomSheet>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Loader2, Pencil, Trash2, Plus } from 'lucide-vue-next'
import BottomSheet from '@/components/tx/BottomSheet.vue'
import { checksumIfChanged } from '@/lib/contacts/evmAddresses'
import {
  EVM_ADDRESS_NETWORKS, listEvmAddresses, saveEvmAddress, deleteEvmAddress,
} from '@/lib/contacts/evmAddresses'

const props = defineProps({
  open: { type: Boolean, default: false },
  // Routes the current asset can be sent on; only these entries are listed.
  networks: { type: Array, default: () => EVM_ADDRESS_NETWORKS },
  // The withdraw form's current route — the filter starts there.
  network: { type: String, default: 'hypercore' },
})
const emit = defineEmits(['close', 'select', 'changed'])

const entries = ref([])
const loading = ref(false)
const loadError = ref('')
const filter = ref('all')
const form = ref(null) // { id?, label, address, network }
const formError = ref('')
const saving = ref(false)
const pendingDelete = ref(null)

const formChecksum = computed(() => (form.value ? checksumIfChanged(form.value.address) : null))

const visible = computed(() =>
  entries.value
    .filter((e) => props.networks.includes(e.network))
    .filter((e) => filter.value === 'all' || e.network === filter.value)
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.label.localeCompare(b.label))
)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    entries.value = await listEvmAddresses()
  } catch (e) {
    console.error('[address-book] load failed:', e)
    loadError.value = 'load_failed'
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  form.value = null
  pendingDelete.value = null
  filter.value = props.networks.length > 1 ? props.network : 'all'
  load()
}, { immediate: true })

function close() {
  emit('close')
}

function pick(entry) {
  emit('select', entry)
}

function startAdd() {
  formError.value = ''
  const network = filter.value !== 'all' ? filter.value : props.network
  form.value = { label: '', address: '', network }
}

function startEdit(entry) {
  formError.value = ''
  form.value = { id: entry.id, label: entry.label, address: entry.address, network: entry.network }
}

async function submitForm() {
  saving.value = true
  formError.value = ''
  try {
    await saveEvmAddress(form.value)
    form.value = null
    await load()
    emit('changed')
  } catch (e) {
    formError.value = ['label_required', 'invalid_address', 'invalid_network', 'duplicate'].includes(e.message) ? e.message : 'save_failed'
    if (formError.value === 'save_failed') console.error('[address-book] save failed:', e)
  } finally {
    saving.value = false
  }
}

async function remove(entry) {
  pendingDelete.value = null
  try {
    await deleteEvmAddress(entry.id)
    await load()
    emit('changed')
  } catch (e) {
    console.error('[address-book] delete failed:', e)
    loadError.value = 'save_failed'
  }
}
</script>
