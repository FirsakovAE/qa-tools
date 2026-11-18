<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '@/i18n'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import { Button } from '@/components/ui/button'
import { ExternalLink, Github, BookOpen, FileText, RefreshCw, Loader2 } from 'lucide-vue-next'
import { useRuntime } from '@/runtime'
import {
  fetchReleaseByTag,
  fetchLatestRelease,
  compareVersions,
  getGithubRepoUrl,
  getPublishedDocsIntroductionUrl,
  type ReleaseDisplayInfo,
} from '@/services/githubReleaseService'

defineProps<{
  settings: InspectorSettings
}>()

const emit = defineEmits<{
  (e: 'show-release', info: ReleaseDisplayInfo): void
}>()

const { t } = useI18n()
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

const githubRepoUrl = getGithubRepoUrl()
const docsIntroductionUrl = getPublishedDocsIntroductionUrl()

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
          error: t('update.versionUnknown'),
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
        error: result.error || t('update.noData'),
      })
      return
    }

    emit('show-release', {
      type: 'release-notes',
      body: result.release.body || t('update.noNotes'),
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
      error: error instanceof Error ? error.message : t('update.fetchFailed'),
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
        error: result.error || t('update.noData'),
      })
      return
    }

    const remoteVersion = result.release.tag_name.replace(/^v/, '')
    const localVersion = runtime.getManifest()?.version || '0.0.0'
    const hasUpdate = compareVersions(remoteVersion, localVersion) > 0

    emit('show-release', {
      type: hasUpdate ? 'update-available' : 'up-to-date',
      body: result.release.body || t('update.noNotes'),
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
      error: error instanceof Error ? error.message : t('update.checkFailed'),
    })
  } finally {
    loadingCheckUpdates.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 1. Product -->
    <div class="space-y-3">
      <h4 class="text-sm font-semibold">Vue Inspector</h4>
      <div class="space-y-2 text-sm text-muted-foreground">
        <p>{{ t('about.blurb') }}</p>
        <p>
          {{ t('about.versionLine') }} <span class="font-mono">{{ appVersion }}</span>
        </p>
      </div>
    </div>

    <!-- 2. Actions -->
    <div class="space-y-3">
      <h4 class="text-sm font-semibold">{{ t('common.actions') }}</h4>
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          class="justify-start h-8 gap-2"
          :disabled="loadingReleaseNotes"
          @click="handleReleaseNotes"
        >
          <Loader2 v-if="loadingReleaseNotes" class="w-3.5 h-3.5 animate-spin" />
          <FileText v-else class="w-3.5 h-3.5" />
          {{ t('about.releaseNotes') }}
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
          {{ t('about.checkUpdates') }}
        </Button>
      </div>
    </div>

    <!-- 3. Links -->
    <div class="border-t border-border pt-4 space-y-3">
      <h4 class="text-sm font-semibold">{{ t('common.links') }}</h4>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-8 justify-start gap-2"
          as="a"
          :href="githubRepoUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github class="w-3.5 h-3.5 shrink-0" />
          GitHub
          <ExternalLink class="w-3 h-3 ml-1 shrink-0 opacity-50" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-8 justify-start gap-2"
          as="a"
          :href="docsIntroductionUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <BookOpen class="w-3.5 h-3.5 shrink-0" />
          {{ t('about.docs') }}
          <ExternalLink class="w-3 h-3 ml-1 shrink-0 opacity-50" />
        </Button>
      </div>
    </div>

    <!-- 4. Legal footer -->
    <div class="border-t border-border pt-4 space-y-1.5 text-xs text-muted-foreground">
      <p>© 2026 FirsakovAE</p>
      <p>
        <a
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          target="_blank"
          rel="noopener noreferrer"
          class="text-foreground/90 underline-offset-4 hover:underline"
        >{{ t('about.license') }}</a>
      </p>
    </div>
  </div>
</template>
