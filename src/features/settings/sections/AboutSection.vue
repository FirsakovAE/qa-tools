<script setup lang="ts">
import { computed } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import { Button } from '@/components/ui/button'
import { ExternalLink, Github } from 'lucide-vue-next'
import { useRuntime } from '@/runtime'

defineProps<{
  settings: InspectorSettings
}>()

const runtime = useRuntime()

const appVersion = computed(() => {
  const manifest = runtime.getManifest()
  const version = manifest?.version
  if (!version || version === '1.0.0') {
    // Standalone mode returns mock manifest with version '1.0.0'
    return runtime.capabilities.mode === 'standalone' ? 'standalone_latest' : 'unknown'
  }
  return version
})
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-3">
      <h4 class="text-sm font-semibold">Vue Inspector</h4>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p>
          A DevTools extension for inspecting Vue.js applications —
          components, props, Pinia stores, and network requests.
        </p>
        <p>
          Version: <span class="font-mono">{{ appVersion }}</span>
        </p>
      </div>
    </div>

    <div class="border-t pt-4 space-y-3">
      <h4 class="text-sm font-semibold">Links</h4>
      <div class="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          class="justify-start h-8 gap-2"
          as="a"
          href="https://github.com"
          target="_blank"
        >
          <Github class="w-3.5 h-3.5" />
          GitHub Repository
          <ExternalLink class="w-3 h-3 ml-auto opacity-50" />
        </Button>
      </div>
    </div>
  </div>
</template>
