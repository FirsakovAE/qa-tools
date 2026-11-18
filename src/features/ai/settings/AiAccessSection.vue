<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { Label } from '@/components/ui/label'
import {
  aiCredentials,
  DEFAULT_AI_ACCESS,
  saveAiCredentials,
  setAiAccess,
} from '../credentials'
import AiSettingsHead from './AiSettingsHead.vue'
import AiSelectRow from './AiSelectRow.vue'

const { t } = useI18n()

const TOOL_ACCESS = computed(() => [
  { id: 'allow' as const, label: t('ai.accessAllowed') },
  { id: 'ask' as const, label: t('ai.accessAsk') },
  { id: 'deny' as const, label: t('common.off') },
])

const SHARING = computed(() => [
  { id: 'on' as const, label: t('ai.accessAllowed') },
  { id: 'off' as const, label: t('common.off') },
])

type Sharing = 'on' | 'off'

const TOOL_GROUPS = computed(() => [
  { id: 'logs' as const, label: t('log.title'), hint: t('ai.logsHint') },
  { id: 'sources' as const, label: t('ai.pageCode'), hint: t('ai.pageCodeHint') },
  { id: 'page' as const, label: t('ai.livePage'), hint: t('ai.livePageHint') },
])

const DATA_SCOPES = computed(() => [
  { id: 'headers' as const, label: t('ai.scopeHeaders'), hint: t('ai.scopeHeadersHint') },
  { id: 'bodies' as const, label: t('ai.scopeBodies'), hint: '' },
  { id: 'appData' as const, label: t('ai.scopeApp'), hint: t('ai.scopeAppHint') },
])

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
      :title="t('ai.agentAccess')"
      :description="t('ai.accessLead')"
      :reset-label="t('common.defaults')"
      :reset-disabled="isDefault"
      @reset="reset"
    />

    <AiSelectRow
      id="ai-access-digest"
      :label="t('ai.attachDigest')"
      :hint="t('ai.attachDigestHint')"
      :options="SHARING"
      :model-value="sharing(aiCredentials.access.digest)"
      @update:model-value="setAiAccess({ digest: $event === 'on' })"
    />

    <div class="space-y-3">
      <Label class="text-xs font-medium text-muted-foreground">{{ t('ai.tools') }}</Label>
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
    </div>

    <div class="space-y-3">
      <Label class="text-xs font-medium text-muted-foreground">{{ t('ai.dataInLogs') }}</Label>
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
