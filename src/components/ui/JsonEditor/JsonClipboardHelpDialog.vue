<script setup lang="ts">
import { computed } from 'vue'
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
        <AlertDialogTitle>Copying and pasting</AlertDialogTitle>
        <AlertDialogDescription class="text-left">
          Clipboard permission is disabled by your browser. You can use:
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div
        class="grid grid-cols-3 gap-1.5 sm:gap-2 text-sm border border-border rounded-md bg-muted/30 px-2 py-4 sm:px-3"
      >
        <div class="flex flex-col items-center justify-center gap-2 text-center min-w-0">
          <span class="text-muted-foreground leading-tight">for copy</span>
          <kbd
            class="inline-flex items-center justify-center rounded border bg-background px-2 py-1 font-mono text-xs shadow-sm"
          >
            {{ modifier }}+C
          </kbd>
        </div>
        <div class="flex flex-col items-center justify-center gap-2 text-center min-w-0">
          <span class="text-muted-foreground leading-tight">for cut</span>
          <kbd
            class="inline-flex items-center justify-center rounded border bg-background px-2 py-1 font-mono text-xs shadow-sm"
          >
            {{ modifier }}+X
          </kbd>
        </div>
        <div class="flex flex-col items-center justify-center gap-2 text-center min-w-0">
          <span class="text-muted-foreground leading-tight">for paste</span>
          <kbd
            class="inline-flex items-center justify-center rounded border bg-background px-2 py-1 font-mono text-xs shadow-sm"
          >
            {{ modifier }}+V
          </kbd>
        </div>
      </div>

      <AlertDialogFooter class="sm:justify-end">
        <AlertDialogAction>
          Close
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
