<script setup lang="ts">
import { ref, computed } from 'vue'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import { Button } from '@/components/ui/button'
import { ExternalLink, Github, FileText, RefreshCw, Loader2 } from 'lucide-vue-next'
import { useRuntime } from '@/runtime'
import {
  fetchReleaseByTag,
  fetchLatestRelease,
  compareVersions,
  type ReleaseDisplayInfo,
} from '@/services/githubReleaseService'

defineProps<{
  settings: InspectorSettings
}>()

const emit = defineEmits<{
  (e: 'show-release', info: ReleaseDisplayInfo): void
}>()

const runtime = useRuntime()
const isExtension = computed(() => runtime.capabilities.mode === 'extension')

const appVersion = computed(() => {
  const manifest = runtime.getManifest()
  const version = manifest?.version
  if (!version || version === '1.0.0') {
    return runtime.capabilities.mode === 'standalone' ? 'standalone_latest' : 'unknown'
  }
  return version
})

const loadingReleaseNotes = ref(false)
const loadingCheckUpdates = ref(false)

async function handleReleaseNotes() {
  loadingReleaseNotes.value = true
  try {
    let result

    if (isExtension.value) {
      const version = runtime.getManifest()?.version
      if (!version) {
        emit('show-release', {
          type: 'release-notes',
          body: '',
          version: '',
          downloadUrl: null,
          error: 'Could not determine current version.',
        })
        return
      }
      result = await fetchReleaseByTag(version)
    } else {
      result = await fetchLatestRelease()
    }

    if (result.error || !result.release) {
      emit('show-release', {
        type: 'release-notes',
        body: '',
        version: '',
        downloadUrl: null,
        error: result.error || 'No release data available.',
      })
      return
    }

    emit('show-release', {
      type: 'release-notes',
      body: result.release.body || 'No release notes available.',
      version: result.release.tag_name.replace(/^v/, ''),
      downloadUrl: result.release.assets?.[0]?.browser_download_url ?? null,
    })
  } catch (error) {
    console.error('[settings/AboutSection] handleReleaseNotes failed:', error)
    emit('show-release', {
      type: 'release-notes',
      body: '',
      version: '',
      downloadUrl: null,
      error: error instanceof Error ? error.message : 'Failed to fetch release notes.',
    })
  } finally {
    loadingReleaseNotes.value = false
  }
}

async function handleCheckUpdates() {
  loadingCheckUpdates.value = true
  try {
    const result = await fetchLatestRelease()

    if (result.error || !result.release) {
      emit('show-release', {
        type: 'release-notes',
        body: '',
        version: '',
        downloadUrl: null,
        error: result.error || 'No release data available.',
      })
      return
    }

    const remoteVersion = result.release.tag_name.replace(/^v/, '')
    const localVersion = runtime.getManifest()?.version || '0.0.0'
    const hasUpdate = compareVersions(remoteVersion, localVersion) > 0

    emit('show-release', {
      type: hasUpdate ? 'update-available' : 'up-to-date',
      body: result.release.body || 'No release notes available.',
      version: remoteVersion,
      downloadUrl: result.release.assets?.[0]?.browser_download_url ?? null,
    })
  } catch (error) {
    console.error('[settings/AboutSection] handleCheckUpdates failed:', error)
    emit('show-release', {
      type: 'release-notes',
      body: '',
      version: '',
      downloadUrl: null,
      error: error instanceof Error ? error.message : 'Failed to check for updates.',
    })
  } finally {
    loadingCheckUpdates.value = false
  }
}
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

    <div class="space-y-3">
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          class="justify-start h-8 gap-2"
          :disabled="loadingReleaseNotes"
          @click="handleReleaseNotes"
        >
          <Loader2 v-if="loadingReleaseNotes" class="w-3.5 h-3.5 animate-spin" />
          <FileText v-else class="w-3.5 h-3.5" />
          Release notes
        </Button>

        <Button
          v-if="isExtension"
          variant="outline"
          size="sm"
          class="justify-start h-8 gap-2"
          :disabled="loadingCheckUpdates"
          @click="handleCheckUpdates"
        >
          <Loader2 v-if="loadingCheckUpdates" class="w-3.5 h-3.5 animate-spin" />
          <RefreshCw v-else class="w-3.5 h-3.5" />
          Check for updates
        </Button>
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
          href="https://github.com/FirsakovAE/qa-tools"
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
