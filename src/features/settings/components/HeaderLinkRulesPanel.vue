<script setup lang="ts">
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { HeaderLinkRuleRowDraft, NetworkHeaderLinkRule } from '@/types/inspector'
import { normalizeNetworkHeaderHost } from '@/utils/networkHeaderLinks'

export type { HeaderLinkRuleRowDraft }

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    variant: 'readonly' | 'editable'
    /** Only when variant === 'readonly' */
    readonlyRules?: NetworkHeaderLinkRule[]
    /** editable: показать Remove all / Add Rule над таблицей (если false — строка действий снаружи) */
    showActionBar?: boolean
  }>(),
  { showActionBar: true },
)

const rows = defineModel<HeaderLinkRuleRowDraft[]>({ default: () => [] })

const emit = defineEmits<{
  (e: 'submit'): void
}>()

function addRow() {
  rows.value = [...rows.value, { id: null, host: '', urlTemplate: '', addedAt: null }]
}

function removeRow(index: number) {
  const next = rows.value.slice()
  next.splice(index, 1)
  rows.value = next
}

function removeAllRows() {
  rows.value = []
}
</script>

<template>
  <div class="space-y-4">
    <template v-if="variant === 'readonly'">
      <div
        v-if="!readonlyRules?.length"
        class="text-sm text-muted-foreground text-center py-8"
      >
        {{ t('netset.noLinkRules') }}
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="w-1/3">{{ t('common.host') }}</TableHead>
            <TableHead>{{ t('netset.link') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="r in readonlyRules" :key="r.id">
            <TableCell class="py-2 align-top font-mono text-xs">
              {{ normalizeNetworkHeaderHost(r.host) }}
            </TableCell>
            <TableCell class="py-2 align-top font-mono text-xs break-all whitespace-pre-wrap">
              {{ r.urlTemplate }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </template>

    <template v-else>
      <div v-if="props.showActionBar" class="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs text-destructive_text hover:text-destructive_text"
          :disabled="rows.length === 0"
          @click="removeAllRows"
        >
          {{ t('common.removeAll') }}
        </Button>
        <Button variant="outline" size="sm" class="h-7 text-xs" @click="addRow">
          {{ t('netset.addRule') }}
        </Button>
      </div>
      <div
        v-if="rows.length === 0"
        class="text-sm text-muted-foreground text-center py-8"
      >
        {{ t('netset.noLinkRules') }}
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="w-1/3">{{ t('common.host') }}</TableHead>
            <TableHead>{{ t('netset.link') }}</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in rows" :key="row.id ?? `r-${index}`">
            <TableCell class="py-2 align-top">
              <Input
                v-model="row.host"
                :placeholder="t('network.phHost')"
                class="h-7 text-xs font-mono"
                autocomplete="off"
                @keydown.enter.prevent="emit('submit')"
              />
            </TableCell>
            <TableCell class="py-2 align-top">
              <Input
                v-model="row.urlTemplate"
                :placeholder="t('netset.tracePh')"
                class="h-7 text-xs font-mono"
                autocomplete="off"
                @keydown.enter.prevent="emit('submit')"
              />
            </TableCell>
            <TableCell class="py-2 text-center align-top">
              <Button
                variant="ghost"
                size="sm"
                class="h-6 w-6 p-0 text-destructive_text hover:text-destructive_text"
                @click="removeRow(index)"
              >
                ×
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <p class="text-xs text-muted-foreground">
        {{ t('netset.valueHelp') }}
      </p>
    </template>
  </div>
</template>

<style scoped>
:deep(table td) {
  vertical-align: top;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
