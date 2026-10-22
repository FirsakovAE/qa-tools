<script setup lang="ts">
import { computed } from 'vue'
import { Label } from '@/components/ui/label'
import {
  aiCredentials,
  DEFAULT_AI_ACCESS,
  saveAiCredentials,
  setAiAccess,
  type AiToolAccess,
  type AiToolGroup,
} from '../credentials'
import AiSettingsHead from './AiSettingsHead.vue'
import AiSelectRow from './AiSelectRow.vue'

const TOOL_ACCESS: Array<{ id: AiToolAccess; label: string }> = [
  { id: 'allow', label: 'Allowed' },
  { id: 'ask', label: 'Ask each time' },
  { id: 'deny', label: 'Off' },
]

const SHARING = [
  { id: 'on', label: 'Allowed' },
  { id: 'off', label: 'Off' },
] as const

type Sharing = typeof SHARING[number]['id']

const TOOL_GROUPS: Array<{ id: AiToolGroup; label: string; hint: string }> = [
  { id: 'logs', label: 'Logs', hint: 'Event details and search over the captured logs' },
  { id: 'sources', label: 'Page code', hint: 'List, read and search the scripts of the page and their source maps' },
]

const DATA_SCOPES: Array<{ id: 'headers' | 'bodies' | 'appData'; label: string; hint: string }> = [
  { id: 'headers', label: 'Request and response headers', hint: 'Sensitive headers stay masked' },
  { id: 'bodies', label: 'Request / response bodies and WebSocket messages', hint: '' },
  { id: 'appData', label: 'Values of store state, props, emits and actions', hint: 'Off: only names, paths and types' },
]

const isDefault = computed(() => JSON.stringify(aiCredentials.access) === JSON.stringify(DEFAULT_AI_ACCESS))

function sharing(on: boolean): Sharing {
  return on ? 'on' : 'off'
}

function reset() {
  void saveAiCredentials({ access: structuredClone(DEFAULT_AI_ACCESS) })
}
</script>

<template>
  <div id="ai-access-section" class="space-y-4 border-t pt-4">
    <AiSettingsHead
      title="Agent access"
      description="What the assistant may read and send to the provider. Every answer lists the shared data and each tool call it made."
      reset-label="Defaults"
      :reset-disabled="isDefault"
      @reset="reset"
    />

    <AiSelectRow
      id="ai-access-digest"
      label="Attach the logs digest to questions"
      hint="A short summary of errors and the timeline. Off: the assistant sees the logs only through the tools below."
      :options="SHARING"
      :model-value="sharing(aiCredentials.access.digest)"
      @update:model-value="setAiAccess({ digest: $event === 'on' })"
    />

    <div class="space-y-3">
      <Label class="text-xs font-medium text-muted-foreground">Tools</Label>
      <AiSelectRow
        v-for="group in TOOL_GROUPS"
        :id="`ai-access-tool-${group.id}`"
        :key="group.id"
        :label="group.label"
        :hint="group.hint"
        :options="TOOL_ACCESS"
        :model-value="aiCredentials.access.tools[group.id]"
        @update:model-value="setAiAccess({ tools: { ...aiCredentials.access.tools, [group.id]: $event } })"
      />
      <p class="text-xs text-muted-foreground">
        Ask each time: the AI tab waits for Allow, Allow in this chat or Deny before the call. The Vue Inspector documentation is always available.
      </p>
    </div>

    <div class="space-y-3">
      <Label class="text-xs font-medium text-muted-foreground">Data in the logs</Label>
      <AiSelectRow
        v-for="scope in DATA_SCOPES"
        :id="`ai-access-${scope.id}`"
        :key="scope.id"
        :label="scope.label"
        :hint="scope.hint"
        :options="SHARING"
        :model-value="sharing(aiCredentials.access[scope.id])"
        @update:model-value="setAiAccess({ [scope.id]: $event === 'on' })"
      />
    </div>
  </div>
</template>
