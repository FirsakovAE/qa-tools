<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { OptionsItemActionsMenuContent, type MenuAction } from '@/components/OptionsItemActionsMenu'
import { MoreHorizontal } from 'lucide-vue-next'

export interface TableColumn {
  header: string
  width?: string
  class?: string
}

const props = withDefaults(
  defineProps<{
    /** Section title */
    title: string
    /** Optional description below title */
    description?: string
    /** Section id for anchor (e.g. 'breakpoints-section') */
    sectionId?: string
    /** Column definitions */
    columns: TableColumn[]
    /** Data rows */
    rows: unknown[]
    /** Get unique key for row */
    rowKey: (row: unknown) => string
    /** Get actions for row */
    getActions: (row: unknown) => MenuAction[]
    /** Message when no rows */
    emptyMessage: string
    /** Currently selected row id */
    selectedItemId?: string | null
    /** Show Add input above table */
    showAdd?: boolean
    /** Add input placeholder */
    addPlaceholder?: string
    /** Add input value (for v-model) */
    addModelValue?: string
    /** Validation error message */
    addError?: string | null
  }>(),
  {
    showAdd: false,
    addPlaceholder: '',
    addModelValue: '',
    addError: null,
  }
)

const emit = defineEmits<{
  (e: 'select', row: unknown): void
  (e: 'add'): void
  (e: 'update:addModelValue', value: string): void
}>()

const tableHeight = computed(() => {
  const rowCount = Math.max(props.rows.length, 1)
  return Math.min(rowCount * 41, 205)
})

const needsScroll = computed(() => props.rows.length > 4)

const colspan = computed(() => props.columns.length + 1)

function onRowClick(row: unknown) {
  emit('select', row)
}

function onAdd() {
  emit('add')
}

function onAddInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    onAdd()
  }
}
</script>

<template>
  <div :id="sectionId" class="space-y-2 border-t pt-4">
    <h4 class="text-sm font-semibold">{{ title }}</h4>
    <p v-if="description" class="text-xs text-muted-foreground">
      {{ description }}
    </p>

    <div v-if="showAdd" class="flex gap-2">
      <Input
        :model-value="addModelValue"
        @update:model-value="emit('update:addModelValue', typeof $event === 'string' ? $event : String($event ?? ''))"
        :placeholder="addPlaceholder"
        @keydown.enter.prevent="onAddInputKeydown"
        :aria-invalid="!!addError"
        class="flex-1 h-8"
      />
      <Button size="sm" @click="onAdd" class="h-8">Add</Button>
    </div>

    <p v-if="addError" class="text-sm text-destructive_text">{{ addError }}</p>

    <div class="flex flex-col border rounded-lg overflow-hidden">
      <!-- Fixed Header -->
      <div class="shrink-0 border-b bg-muted/30">
        <Table class="table-fixed">
          <TableHeader class="[&_th]:h-10">
            <TableRow class="hover:bg-transparent">
              <TableHead
                v-for="col in columns"
                :key="col.header"
                class="text-xs font-semibold"
                :class="col.class"
                :style="col.width ? { width: col.width } : undefined"
              >
                {{ col.header }}
              </TableHead>
              <TableHead class="w-[48px] text-center p-0" />
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      <!-- Scrollable Body -->
      <div class="min-h-0 max-h-[205px] overflow-hidden">
        <template v-if="needsScroll">
          <ScrollArea :style="{ height: `${tableHeight}px` }">
            <Table class="table-fixed">
              <TableBody>
                <ContextMenu v-for="row in rows" :key="rowKey(row)">
                  <ContextMenuTrigger as-child>
                    <TableRow
                      class="h-[41px] cursor-pointer transition-colors"
                      :class="{ 'bg-muted': selectedItemId === rowKey(row) }"
                      @click="onRowClick(row)"
                    >
                      <slot name="row" :row="row">
                        <!-- Default: no cells, parent must provide -->
                      </slot>
                      <TableCell class="w-[48px] text-center p-0">
                        <div class="flex justify-center items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                              <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                                <MoreHorizontal class="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <OptionsItemActionsMenuContent
                              variant="dropdown"
                              :actions="getActions(row)"
                            />
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <OptionsItemActionsMenuContent
                    variant="context"
                    :actions="getActions(row)"
                  />
                </ContextMenu>

                <TableRow v-if="!rows.length">
                  <TableCell :colspan="colspan" class="text-center text-muted-foreground py-8">
                    {{ emptyMessage }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
        </template>
        <template v-else>
          <Table class="table-fixed">
            <TableBody>
              <ContextMenu v-for="row in rows" :key="rowKey(row)">
                <ContextMenuTrigger as-child>
                  <TableRow
                    class="h-[41px] cursor-pointer transition-colors"
                    :class="{ 'bg-muted': selectedItemId === rowKey(row) }"
                    @click="onRowClick(row)"
                  >
                    <slot name="row" :row="row">
                      <!-- Default: no cells, parent must provide -->
                    </slot>
                    <TableCell class="w-[48px] text-center p-0">
                      <div class="flex justify-center items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger as-child>
                            <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                              <MoreHorizontal class="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <OptionsItemActionsMenuContent
                            variant="dropdown"
                            :actions="getActions(row)"
                          />
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                </ContextMenuTrigger>
                <OptionsItemActionsMenuContent
                  variant="context"
                  :actions="getActions(row)"
                />
              </ContextMenu>
              <TableRow v-if="!rows.length">
                <TableCell :colspan="colspan" class="text-center text-muted-foreground py-8">
                  {{ emptyMessage }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </template>
      </div>
    </div>
  </div>
</template>
