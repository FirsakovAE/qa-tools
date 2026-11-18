<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/i18n'
import { RotateCcw, Trash } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { TableCell } from '@/components/ui/table'
import SettingsTableSection from '@/features/settings/components/SettingsTableSection.vue'
import type { TableColumn } from '@/features/settings/components/SettingsTableSection.vue'
import type { MenuAction } from '@/components/OptionsItemActionsMenu'
import { aiCredentials, DEFAULT_AI_MASK_KEYS, setAiMasking } from '../credentials'
import AiFlag from './AiFlag.vue'

const { t } = useI18n()
const newKey = ref('')
const error = ref<string | null>(null)
const columns = computed<TableColumn[]>(() => [{ header: t('logset.keyContains'), class: 'min-w-0' }])
const rows = computed(() => aiCredentials.masking.keys.map(k => ({ key: k })))

function add() {
  const value = newKey.value.trim()
  error.value = null
  if (!value) {
    error.value = t('logset.keyEmpty')
    return
  }
  if (aiCredentials.masking.keys.some(k => k.toLowerCase() === value.toLowerCase())) {
    error.value = t('logset.keyExists')
    return
  }
  void setAiMasking({ keys: [...aiCredentials.masking.keys, value] })
  newKey.value = ''
}

function reset() {
  void setAiMasking({ keys: [...DEFAULT_AI_MASK_KEYS], valuePatterns: true })
}

function actions(row: { key: string }): MenuAction[] {
  return [{
    label: t('general.delete'),
    icon: Trash,
    onClick: () => void setAiMasking({ keys: aiCredentials.masking.keys.filter(k => k !== row.key) }),
    destructiveText: true,
  }]
}
</script>

<template>
  <SettingsTableSection
    section-id="ai-masking-section"
    :title="t('ai.maskingTitle')"
    :columns="columns"
    :rows="rows"
    :row-key="(r) => (r as { key: string }).key"
    :get-actions="(row) => actions(row as { key: string })"
    :empty-message="t('logset.noKeys')"
    show-add
    :add-placeholder="t('ai.maskPh')"
    v-model:add-model-value="newKey"
    :add-error="error"
    @add="add"
  >
    <template #title-actions>
      <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5 shrink-0" @click="reset">
        <RotateCcw class="h-3.5 w-3.5" />
        {{ t('common.defaults') }}
      </Button>
    </template>
    <template #after-title>
      <div class="space-y-2 pt-1">
        <p class="text-xs text-muted-foreground">
          {{ t('ai.maskNote') }}
        </p>
        <AiFlag
          id="ai-masking-patterns"
          :label="t('logset.mask')"
          :model-value="aiCredentials.masking.valuePatterns"
          @update:model-value="setAiMasking({ valuePatterns: $event })"
        />
      </div>
    </template>
    <template #row="{ row }">
      <TableCell class="min-w-0 overflow-hidden !py-2">
        <div class="text-sm font-mono truncate">{{ (row as { key: string }).key }}</div>
      </TableCell>
    </template>
  </SettingsTableSection>
</template>
