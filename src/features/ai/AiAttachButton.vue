<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/i18n'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { attachLogFile } from './logFile'
import { attachFiles } from './attachments'
import { TEXT_FILE_ACCEPT } from './textFiles'

const { t } = useI18n()
const file = ref<HTMLInputElement | null>(null)
const textFile = ref<HTMLInputElement | null>(null)

function pick() {
  file.value?.click()
}

function pickText() {
  textFile.value?.click()
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  if (picked) await attachLogFile(picked)
}

async function onTextFile(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  await attachFiles(picked)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8 rounded-full" :title="t('ai.attach')" :aria-label="t('ai.attach')">
        <Plus class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" class="min-w-[200px]">
      <DropdownMenuItem @select="pickText">
        <div class="flex flex-col">
          <span>{{ t('ai.attachText') }}</span>
          <span class="text-[10px] text-muted-foreground">TXT · LOG · JSON · HAR · MD · CSV · PDF</span>
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem @select="pick">{{ t('ai.attachLog') }}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <input ref="file" type="file" accept=".html,.htm,.json,text/html,application/json" class="hidden" @change="onFile" />
  <input ref="textFile" type="file" multiple :accept="TEXT_FILE_ACCEPT" class="hidden" data-testid="ai-text-file-input" @change="onTextFile" />
</template>
