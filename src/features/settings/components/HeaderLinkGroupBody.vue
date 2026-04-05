<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { HeaderLinkRuleRowDraft, NetworkHeaderLinkRule } from '@/types/inspector'
import HeaderLinkRulesPanel from '@/features/settings/components/HeaderLinkRulesPanel.vue'

defineProps<{
  displayHeader: string
  editMode: boolean
  readonlyRules: NetworkHeaderLinkRule[]
  lastUpdated: string | null
}>()

const rows = defineModel<HeaderLinkRuleRowDraft[]>({ required: true })

const emit = defineEmits<{
  (e: 'submit'): void
}>()

function addHeaderLinkRow() {
  rows.value = [
    ...rows.value,
    { id: null, host: '', urlTemplate: '', addedAt: null },
  ]
}

function removeAllHeaderLinkRows() {
  rows.value = []
}
</script>

<template>
  <div class="space-y-4">
    <template v-if="!editMode">
      <div>
        <span class="text-xs text-muted-foreground">Header</span>
        <p class="font-mono text-sm font-semibold mt-1">{{ displayHeader }}</p>
      </div>
      <HeaderLinkRulesPanel
        variant="readonly"
        :readonly-rules="readonlyRules"
      />
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div class="min-w-0 flex-1">
          <span class="text-xs text-muted-foreground">Header</span>
          <p class="font-mono text-sm font-semibold mt-1 break-all">{{ displayHeader }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-7 text-xs text-destructive_text hover:text-destructive_text"
            :disabled="rows.length === 0"
            @click="removeAllHeaderLinkRows"
          >
            Remove all
          </Button>
          <Button variant="outline" size="sm" class="h-7 text-xs" @click="addHeaderLinkRow">
            Add Rule
          </Button>
        </div>
      </div>
      <HeaderLinkRulesPanel
        variant="editable"
        :show-action-bar="false"
        v-model="rows"
        @submit="emit('submit')"
      />
    </template>

    <div v-if="lastUpdated">
      <span class="text-xs text-muted-foreground">Last updated</span>
      <p class="text-sm mt-1">{{ new Date(lastUpdated).toLocaleString() }}</p>
    </div>
  </div>
</template>
