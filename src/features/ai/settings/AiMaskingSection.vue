<script setup lang="ts">
import { computed, ref } from 'vue'
import { Trash } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { TableCell } from '@/components/ui/table'
import SettingsTableSection from '@/features/settings/components/SettingsTableSection.vue'
import type { TableColumn } from '@/features/settings/components/SettingsTableSection.vue'
import type { MenuAction } from '@/components/OptionsItemActionsMenu'
import { aiCredentials, DEFAULT_AI_MASK_KEYS, setAiMasking } from '../credentials'
import AiFlag from './AiFlag.vue'

const newKey = ref('')
const error = ref<string | null>(null)
const columns: TableColumn[] = [{ header: 'Key contains', class: 'min-w-0' }]
const rows = computed(() => aiCredentials.masking.keys.map(k => ({ key: k })))

function add() {
  const value = newKey.value.trim()
  error.value = null
  if (!value) {
    error.value = 'Key cannot be empty'
    return
  }
  if (aiCredentials.masking.keys.some(k => k.toLowerCase() === value.toLowerCase())) {
    error.value = 'This key is already in the list'
    return
  }
  void setAiMasking({ keys: [...aiCredentials.masking.keys, value] })
  newKey.value = ''
}

function actions(row: { key: string }): MenuAction[] {
  return [{
    label: 'Delete',
    icon: Trash,
    onClick: () => void setAiMasking({ keys: aiCredentials.masking.keys.filter(k => k !== row.key) }),
    destructiveText: true,
  }]
}
</script>

<template>
  <SettingsTableSection
    section-id="ai-masking-section"
    title="Data masking for AI"
    description="Applied to everything the assistant sends: the logs digest, event data, page code. Works on top of Options → Logs → Data masking and does not change the Logs view or exports."
    :columns="columns"
    :rows="rows"
    :row-key="(r) => (r as { key: string }).key"
    :get-actions="(row) => actions(row as { key: string })"
    empty-message="No keys — only value patterns are masked"
    show-add
    add-placeholder="Key fragment, e.g. x-client-secret"
    v-model:add-model-value="newKey"
    :add-error="error"
    @add="add"
  >
    <template #after-title>
      <div class="space-y-2 pt-1">
        <p class="text-xs text-muted-foreground">
          Object keys, headers, URL params and <code>name: "value"</code> pairs in the code whose name contains a fragment are sent as [MASKED].
          Fragments of 4 letters or less (auth, jwt, otp) match a whole word of the name.
        </p>
        <AiFlag
          id="ai-masking-patterns"
          label="Mask token-like values in any text (JWT, Bearer / Basic credentials, card numbers)"
          :model-value="aiCredentials.masking.valuePatterns"
          @update:model-value="setAiMasking({ valuePatterns: $event })"
        />
        <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5" @click="setAiMasking({ keys: [...DEFAULT_AI_MASK_KEYS] })">
          Default keys
        </Button>
      </div>
    </template>
    <template #row="{ row }">
      <TableCell class="min-w-0 overflow-hidden !py-2">
        <div class="text-sm font-mono truncate">{{ (row as { key: string }).key }}</div>
      </TableCell>
    </template>
  </SettingsTableSection>
</template>
