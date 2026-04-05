<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, Save } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import type { HeaderLinkRuleRowDraft } from '@/types/inspector'
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import {
  replaceHeaderLinkRulesForHeaderName,
} from '@/utils/networkHeaderLinks'
import HeaderLinkGroupBody from '@/features/settings/components/HeaderLinkGroupBody.vue'

const props = defineProps<{
  headerName: string
  entryHost: string
  mode: 'create' | 'edit'
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const settings = useInspectorSettingsSync()
const rows = ref<HeaderLinkRuleRowDraft[]>([])

const rulesForHeader = computed(() => {
  const list = settings.value?.networkHeaderLinks
  const hnLower = props.headerName.toLowerCase()
  if (!Array.isArray(list)) return []
  return list.filter((r) => r.headerName.toLowerCase() === hnLower)
})

const displayHeader = computed(() =>
  rulesForHeader.value[0]?.headerName ?? props.headerName,
)

const lastUpdated = computed(() => {
  const rs = rulesForHeader.value
  if (!rs.length) return null
  return rs.reduce((latest, r) => (r.addedAt > latest ? r.addedAt : latest), rs[0]!.addedAt)
})

function loadRowsFromSettings() {
  if (props.mode === 'create') {
    rows.value = [
      { id: null, host: props.entryHost, urlTemplate: '', valueExtractRegex: '', valueTransform: '', addedAt: null },
    ]
    return
  }
  const existing = rulesForHeader.value
  rows.value = existing.length
    ? existing.map((r) => ({
        id: r.id,
        host: r.host,
        urlTemplate: r.urlTemplate,
        valueExtractRegex: r.valueExtractRegex ?? '',
        valueTransform: r.valueTransform ?? '',
        addedAt: r.addedAt,
      }))
    : [{ id: null, host: props.entryHost, urlTemplate: '', valueExtractRegex: '', valueTransform: '', addedAt: null }]
}

function syncEditorFromSettings() {
  loadRowsFromSettings()
}

watch(
  () => [props.headerName, props.mode, props.entryHost] as const,
  syncEditorFromSettings,
  { immediate: true },
)

/** После onMounted приходит `settings`; без этого правила не подставляются в таблицу. */
watch(rulesForHeader, syncEditorFromSettings, { deep: true })

function save() {
  if (!settings.value) return
  if (!Array.isArray(settings.value.networkHeaderLinks)) {
    settings.value.networkHeaderLinks = []
  }
  replaceHeaderLinkRulesForHeaderName(
    settings.value.networkHeaderLinks,
    displayHeader.value,
    rows.value,
  )
  emit('close')
}
</script>

<template>
  <div class="rounded-lg border bg-card/50 mb-4 overflow-hidden">
    <div class="shrink-0 flex items-center gap-2 p-2 border-b bg-muted/20">
      <span class="text-sm font-semibold">Header Link Details</span>
      <div class="flex-1 min-w-0" />
      <Button type="button" variant="ghost" size="icon" class="h-7 w-7 shrink-0" title="Cancel" @click="emit('close')">
        <X class="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" class="h-7 w-7 shrink-0" title="Save" @click="save">
        <Save class="h-4 w-4" />
      </Button>
    </div>
    <div class="p-4">
      <HeaderLinkGroupBody
        v-model="rows"
        :display-header="displayHeader"
        :edit-mode="true"
        :readonly-rules="rulesForHeader"
        :last-updated="lastUpdated"
        @submit="save"
      />
    </div>
  </div>
</template>
