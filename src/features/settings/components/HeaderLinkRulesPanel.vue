<script setup lang="ts">
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
  rows.value = [
    ...rows.value,
    { id: null, host: '', urlTemplate: '', valueExtractRegex: '', valueTransform: '', addedAt: null },
  ]
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
        No link rules
      </div>
      <div v-else class="overflow-x-auto -mx-1 px-1">
        <Table class="table-fixed w-full min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead class="w-[18%]">Host</TableHead>
            <TableHead class="w-[28%]">Link</TableHead>
            <TableHead class="w-[22%]">Extract regex</TableHead>
            <TableHead class="w-[30%]">Transform</TableHead>
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
            <TableCell class="py-2 align-top font-mono text-xs text-muted-foreground break-all whitespace-pre-wrap">
              {{ r.valueExtractRegex?.trim() ? r.valueExtractRegex : '—' }}
            </TableCell>
            <TableCell class="py-2 align-top font-mono text-xs text-muted-foreground break-all whitespace-pre-wrap">
              {{ r.valueTransform?.trim() ? r.valueTransform : '—' }}
            </TableCell>
          </TableRow>
        </TableBody>
        </Table>
      </div>
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
          Remove all
        </Button>
        <Button variant="outline" size="sm" class="h-7 text-xs" @click="addRow">
          Add Rule
        </Button>
      </div>
      <div
        v-if="rows.length === 0"
        class="text-sm text-muted-foreground text-center py-8"
      >
        No link rules
      </div>
      <div v-else class="overflow-x-auto -mx-1 px-1">
        <Table class="table-fixed w-full min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead class="w-[17%]">Host</TableHead>
              <TableHead class="w-[26%]">Link</TableHead>
              <TableHead class="w-[20%]">Extract regex</TableHead>
              <TableHead class="w-[30%]">Transform</TableHead>
              <TableHead class="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in rows" :key="row.id ?? `r-${index}`">
              <TableCell class="py-2 align-top">
                <Input
                  v-model="row.host"
                  placeholder="api.example.com"
                  class="h-7 text-xs font-mono"
                  autocomplete="off"
                  @keydown.enter.prevent="emit('submit')"
                />
              </TableCell>
              <TableCell class="py-2 align-top">
                <Input
                  v-model="row.urlTemplate"
                  placeholder="https://example.com/trace/{value}"
                  class="h-7 text-xs font-mono"
                  autocomplete="off"
                  @keydown.enter.prevent="emit('submit')"
                />
              </TableCell>
              <TableCell class="py-2 align-top">
                <Input
                  v-model="row.valueExtractRegex"
                  placeholder="([a-f0-9-]+)"
                  class="h-7 text-xs font-mono"
                  autocomplete="off"
                  @keydown.enter.prevent="emit('submit')"
                />
              </TableCell>
              <TableCell class="py-2 align-top">
                <Input
                  v-model="row.valueTransform"
                  placeholder='replace("-", "") | lowercase()'
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
      </div>
      <p class="text-xs text-muted-foreground space-y-1.5">
        <span>
          Use <code class="text-[11px]">{{ '{value}' }}</code> where the header value should go.
        </span>
        <span class="block">
          <strong class="font-medium text-foreground/80">Extract regex</strong> —
          <code class="text-[11px]">new RegExp(pattern)</code>, applied to the raw header value. Uses the first capturing group
          when present, otherwise the full match. If the pattern is invalid or does not match, the raw value is unchanged before
          transforms.
        </span>
        <span class="block">
          <strong class="font-medium text-foreground/80">Transform</strong> —
          optional steps after extraction, separated by <code class="text-[11px]">|</code> (left to right).
          Examples: <code class="text-[11px]">trim()</code>, <code class="text-[11px]">lowercase()</code>,
          <code class="text-[11px]">replace("-", "")</code>,
          <code class="text-[11px]">substring(0,8)</code>, <code class="text-[11px]">removeNonDigits()</code>,
          <code class="text-[11px]">prefix("id-")</code>, <code class="text-[11px]">suffix("-prod")</code>.
        </span>
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
