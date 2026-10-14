<script setup lang="ts">
import { computed } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'
import VirtualTable from '@/components/VirtualTable.vue'
import RowCheckCell from '@/components/RowCheckCell.vue'
import type { RowCheckState } from '@/composables/useRowSelection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/ContextMenu'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import type { LogEvent } from '@/types/logs'
import LogActionsMenuContent from './LogActionsMenuContent.vue'
import { formatLogTime } from './format'
import { describeLog, logBadgeClass, logLabel, type LogsSource } from './view'

const props = defineProps<{
  events: LogEvent[]
  /** Events and network entries the rows are read from */
  source: LogsSource
  selectedId: string | null
  emptyMessage?: string
  /** Rows ticked for export */
  checkedIds: ReadonlySet<string>
  headerCheckState: RowCheckState
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  /** Checkbox click or Shift/Ctrl/Cmd+click on a row */
  (e: 'check', id: string, event: MouseEvent): void
  (e: 'checkAll'): void
  (e: 'export', event: LogEvent): void
  (e: 'copyCurl', event: LogEvent): void
  (e: 'ignore', event: LogEvent): void
}>()

// Newest first
const sortedEvents = computed(() => [...props.events].reverse())

function describe(event: LogEvent) {
  return describeLog(event, props.source)
}

function onRowClick(id: string, event: MouseEvent) {
  if (event.shiftKey || event.ctrlKey || event.metaKey) emit('check', id, event)
  else emit('select', id)
}

function onRowMousedown(event: MouseEvent) {
  if (event.shiftKey) event.preventDefault()
}

const ROW_HEIGHT = 40
</script>

<template>
  <VirtualTable
    :items="sortedEvents"
    key-field="id"
    :item-size="ROW_HEIGHT"
    min-width="460px"
    :empty-message="emptyMessage ?? 'No events logged yet'"
  >
    <template #header>
      <RowCheckCell
        header
        :state="headerCheckState"
        :title="headerCheckState === true ? 'Unselect all' : 'Select all for export (Ctrl+A)'"
        @toggle="emit('checkAll')"
      />
      <div class="log-cell log-cell-time">Time</div>
      <div class="log-cell log-cell-type">Type</div>
      <div class="log-cell log-cell-event">Event</div>
      <div class="log-cell virtual-table__cell-actions" />
    </template>

    <template #default="{ item: event }">
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <div
            class="log-row virtual-table__row"
            :class="{
              'log-row-selected': selectedId === event.id,
              'log-row-error': event.level === 'error',
              'log-row-warn': event.level === 'warn',
            }"
            @mousedown="onRowMousedown"
            @click="onRowClick(event.id, $event)"
          >
            <RowCheckCell
              :state="checkedIds.has(event.id)"
              title="Select for export (Shift — range, Ctrl/Cmd+click on row — toggle)"
              @toggle="emit('check', event.id, $event)"
            />
            <div class="log-cell log-cell-time">
              {{ formatLogTime(event.timestamp) }}
            </div>

            <div class="log-cell log-cell-type">
              <Badge
                variant="outline"
                class="text-[11px] px-1.5 py-0 whitespace-nowrap"
                :class="logBadgeClass(event)"
              >
                {{ logLabel(event) }}
              </Badge>
            </div>

            <div class="log-cell log-cell-event">
              <div class="truncate text-sm" :title="describe(event).title">{{ describe(event).title }}</div>
              <div
                v-if="describe(event).subtitle"
                class="truncate text-xs"
                :class="event.level === 'error' ? 'text-destructive_text' : 'text-muted-foreground'"
                :title="describe(event).subtitle"
              >
                {{ describe(event).subtitle }}
              </div>
            </div>

            <div class="log-cell virtual-table__cell-actions">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-6 w-6 p-0" @click.stop>
                    <MoreHorizontal class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <LogActionsMenuContent
                  variant="dropdown"
                  :event="event"
                  @export="emit('export', $event)"
                  @copy-curl="emit('copyCurl', $event)"
                  @ignore="emit('ignore', $event)"
                />
              </DropdownMenu>
            </div>
          </div>
        </ContextMenuTrigger>

        <LogActionsMenuContent
          variant="context"
          :event="event"
          @export="emit('export', $event)"
          @copy-curl="emit('copyCurl', $event)"
          @ignore="emit('ignore', $event)"
        />
      </ContextMenu>
    </template>
  </VirtualTable>
</template>

<style scoped>
.log-row {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  padding-right: 0;
  cursor: pointer;
  transition: background-color 0.1s;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
}

.log-cell {
  flex-shrink: 0;
  padding: 0 4px;
}

.log-cell-time {
  width: 92px;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-family: ui-monospace, monospace;
}

.log-cell-type {
  width: 128px;
}

.log-cell-event {
  flex: 1;
  min-width: 0;
  text-align: left;
  line-height: 1.2;
}

.log-row-error {
  box-shadow: inset 2px 0 0 hsl(0 84% 60% / 0.6);
}

.log-row-warn {
  box-shadow: inset 2px 0 0 hsl(25 95% 53% / 0.6);
}

.log-row-selected {
  background: hsl(var(--muted));
}

.log-row:hover:not(.log-row-selected) {
  background: hsl(var(--accent));
}
</style>
