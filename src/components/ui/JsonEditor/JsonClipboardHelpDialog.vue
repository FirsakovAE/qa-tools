<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/** Replaces vanilla-jsoneditor’s “Copying and pasting” modal (clipboard blocked) with UI-kit primitives. */

const { t } = useI18n()
const modelOpen = defineModel<boolean>({ default: false })

const modifier = computed(() => {
  const ud = navigator.userAgentData
  const plat =
    (typeof ud?.platform === 'string' ? ud.platform : '')
    || navigator.platform
    || ''
  const ua = navigator.userAgent ?? ''
  const apple =
    /Mac|iPhone|iPod|iPad/i.test(plat) || ua.includes('Mac OS')
  return apple ? '⌘' : 'Ctrl'
})
</script>

<template>
  <AlertDialog v-model:open="modelOpen">
    <AlertDialogContent class="gap-6 sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('editor.clipboardTitle') }}</AlertDialogTitle>
        <AlertDialogDescription class="text-left">
          {{ t('editor.clipboardBody') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div
        class="grid grid-cols-3 gap-1.5 sm:gap-2 text-sm border border-border rounded-md bg-muted/30 px-2 py-4 sm:px-3"
      >
        <div class="flex flex-col items-center justify-center gap-2 text-center min-w-0">
          <span class="text-muted-foreground leading-tight">{{ t('editor.forCopy') }}</span>
          <kbd
            class="inline-flex items-center justify-center rounded border bg-background px-2 py-1 font-mono text-xs shadow-sm"
          >
            {{ modifier }}+C
          </kbd>
        </div>
        <div class="flex flex-col items-center justify-center gap-2 text-center min-w-0">
          <span class="text-muted-foreground leading-tight">{{ t('editor.forCut') }}</span>
          <kbd
            class="inline-flex items-center justify-center rounded border bg-background px-2 py-1 font-mono text-xs shadow-sm"
          >
            {{ modifier }}+X
          </kbd>
        </div>
        <div class="flex flex-col items-center justify-center gap-2 text-center min-w-0">
          <span class="text-muted-foreground leading-tight">{{ t('editor.forPaste') }}</span>
          <kbd
            class="inline-flex items-center justify-center rounded border bg-background px-2 py-1 font-mono text-xs shadow-sm"
          >
            {{ modifier }}+V
          </kbd>
        </div>
      </div>

      <AlertDialogFooter class="sm:justify-end">
        <AlertDialogAction>
          {{ t('common.close') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
