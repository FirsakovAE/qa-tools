<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import '@/assets/markdown.css'
import type { InspectorSettings } from '@/settings/inspectorSettings'
import type { BreakpointItem, MockRule, FavoriteItem } from '@/types/inspector'
import type { ReleaseDisplayInfo } from '@/services/githubReleaseService'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Download,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  Pencil,
} from 'lucide-vue-next'

marked.setOptions({ breaks: true, gfm: true })

const renderedBody = computed(() => {
  const body = props.releaseInfo?.body
  if (!body) return ''
  return marked.parse(body) as string
})

const props = defineProps<{
  settings: InspectorSettings
  selectedItem: { type: 'breakpoint' | 'mock' | 'blacklist' | 'favorite'; id: string } | null
  releaseInfo?: ReleaseDisplayInfo | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'close-release'): void
  (e: 'ignore-version', version: string): void
  (e: 'download-update', url: string): void
  (e: 'edit'): void
}>()

// -------------------- LOOKUP DATA --------------------
const breakpointData = computed<(BreakpointItem & { active: boolean }) | null>(() => {
  if (props.selectedItem?.type !== 'breakpoint') return null
  const id = props.selectedItem.id
  const active = props.settings.breakpoints.active.find(bp => bp.id === id)
  if (active) return { ...active, active: true }
  const inactive = props.settings.breakpoints.inactive.find(bp => bp.id === id)
  if (inactive) return { ...inactive, active: false }
  return null
})

const mockData = computed<(MockRule & { active: boolean }) | null>(() => {
  if (props.selectedItem?.type !== 'mock') return null
  const id = props.selectedItem.id
  const active = props.settings.mocks.active.find(m => m.id === id)
  if (active) return { ...active, active: true }
  const inactive = props.settings.mocks.inactive.find(m => m.id === id)
  if (inactive) return { ...inactive, active: false }
  return null
})

const blacklistData = computed<{ name: string; active: boolean } | null>(() => {
  if (props.selectedItem?.type !== 'blacklist') return null
  const name = props.selectedItem.id
  if (props.settings.blacklist.active.includes(name)) return { name, active: true }
  if (props.settings.blacklist.inactive.includes(name)) return { name, active: false }
  return null
})

const favoriteData = computed<FavoriteItem | null>(() => {
  if (props.selectedItem?.type !== 'favorite') return null
  return props.settings.favorites.find(f => f.id === props.selectedItem!.id) || null
})

// -------------------- FORMATTERS --------------------
function formatBreakpointUrl(bp: BreakpointItem): string {
  let url = `${bp.scheme}://${bp.host}`
  if (bp.port) url += `:${bp.port}`
  url += bp.path
  if (bp.query) url += `?${bp.query}`
  return url
}

function formatTrigger(trigger: string): string {
  if (trigger === 'both') return 'Request & Response'
  return trigger.charAt(0).toUpperCase() + trigger.slice(1)
}
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- ===== Release Info Panel ===== -->
    <template v-if="releaseInfo && !selectedItem">

      <!-- Header -->
      <div class="shrink-0 flex items-center gap-2 p-2 border-b">
        <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close-release')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <span v-if="releaseInfo.type === 'update-available'" class="text-sm font-semibold">
          Update Available
        </span>
        <span v-else-if="releaseInfo.type === 'up-to-date'" class="text-sm font-semibold">
          Up to Date
        </span>
        <span v-else class="text-sm font-semibold">
          Release Notes
        </span>
      </div>

      <ScrollArea class="flex-1 min-h-0">
        <div class="p-4 space-y-4">

          <!-- Error -->
          <template v-if="releaseInfo.error">
            <div class="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" />
              <p class="text-sm">{{ releaseInfo.error }}</p>
            </div>
          </template>

          <!-- Update Available -->
          <template v-else-if="releaseInfo.type === 'update-available'">
            <div class="space-y-4">
              <div class="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <ArrowUpCircle class="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p class="text-sm font-semibold">Update Available</p>
                  <p class="text-sm text-muted-foreground">
                    Download new version {{ releaseInfo.version }}
                  </p>
                </div>
              </div>

              <div>
                <span class="text-xs text-muted-foreground">What's New</span>
                <div class="mt-2 text-sm break-words font-sans leading-relaxed markdown-body" v-html="renderedBody" />
              </div>

              <div class="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  class="gap-1.5"
                  @click="emit('ignore-version', releaseInfo!.version)"
                >
                  <EyeOff class="w-3.5 h-3.5" />
                  Ignore
                </Button>
                <Button
                  size="sm"
                  class="gap-1.5"
                  :disabled="!releaseInfo.downloadUrl"
                  @click="releaseInfo!.downloadUrl && emit('download-update', releaseInfo!.downloadUrl)"
                >
                  <Download class="w-3.5 h-3.5" />
                  Download
                </Button>
              </div>
            </div>
          </template>

          <!-- Up to Date -->
          <template v-else-if="releaseInfo.type === 'up-to-date'">
            <div class="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <CheckCircle2 class="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p class="text-sm font-semibold">You're up to date!</p>
                <p class="text-sm text-muted-foreground">
                  Version {{ releaseInfo.version }} is the latest.
                </p>
              </div>
            </div>

            <div v-if="releaseInfo.body">
              <span class="text-xs text-muted-foreground">Current Release Notes</span>
              <div class="mt-2 text-sm break-words font-sans leading-relaxed markdown-body" v-html="renderedBody" />
            </div>
          </template>

          <!-- Release Notes -->
          <template v-else>
            <div v-if="releaseInfo.version" class="text-xs text-muted-foreground">
              Version {{ releaseInfo.version }}
            </div>
            <div class="text-sm break-words font-sans leading-relaxed markdown-body" v-html="renderedBody" />
          </template>

        </div>
      </ScrollArea>
    </template>

    <!-- ===== Selected Item Details ===== -->
    <template v-else-if="selectedItem">
      <!-- Header -->
      <div class="shrink-0 flex items-center gap-2 p-2 border-b">
        <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <span class="text-sm font-semibold capitalize">{{ selectedItem.type }} Details</span>
        <div class="flex-1" />
        <Button
          v-if="selectedItem.type === 'breakpoint' || selectedItem.type === 'mock'"
          variant="outline"
          size="sm"
          class="h-7 text-xs gap-1.5"
          @click="emit('edit')"
        >
          <Pencil class="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      <!-- Content -->
      <ScrollArea class="flex-1 min-h-0">
        <div class="p-4 space-y-4">

          <!-- Breakpoint Details -->
          <template v-if="selectedItem.type === 'breakpoint' && breakpointData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">URL Pattern</span>
                <p class="font-mono text-sm break-all mt-1">{{ formatBreakpointUrl(breakpointData) }}</p>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-xs text-muted-foreground">Method</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.method || 'All' }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Status</span>
                  <p class="text-sm mt-1">{{ breakpointData.active ? 'Active' : 'Disabled' }}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-xs text-muted-foreground">Scheme</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.scheme }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Host</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.host }}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div v-if="breakpointData.port">
                  <span class="text-xs text-muted-foreground">Port</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.port }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Path</span>
                  <p class="text-sm font-mono mt-1">{{ breakpointData.path }}</p>
                </div>
              </div>

              <div v-if="breakpointData.query">
                <span class="text-xs text-muted-foreground">Query</span>
                <p class="text-sm font-mono mt-1">{{ breakpointData.query }}</p>
              </div>

              <div>
                <span class="text-xs text-muted-foreground">Created</span>
                <p class="text-sm mt-1">{{ new Date(breakpointData.timestamp).toLocaleString() }}</p>
              </div>
            </div>
          </template>

          <!-- Mock Details -->
          <template v-else-if="selectedItem.type === 'mock' && mockData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">URL Pattern</span>
                <p class="font-mono text-sm break-all mt-1">
                  {{ mockData.method ? mockData.method + ' ' : '' }}{{ mockData.scheme || '*' }}://{{ mockData.host || '*' }}{{ mockData.port ? ':' + mockData.port : '' }}{{ mockData.path || '/*' }}{{ mockData.query ? '?' + mockData.query : '' }}
                </p>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div>
                  <span class="text-xs text-muted-foreground">Status</span>
                  <p
                    class="text-sm font-mono mt-1"
                    :class="{
                      'text-green-500': mockData.status >= 200 && mockData.status < 300,
                      'text-orange-500': mockData.status >= 400 && mockData.status < 500,
                      'text-red-500': mockData.status >= 500
                    }"
                  >
                    {{ mockData.status }} {{ mockData.statusText || '' }}
                  </p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">Delay</span>
                  <p class="text-sm mt-1">{{ mockData.delay ? mockData.delay + 'ms' : 'None' }}</p>
                </div>
                <div>
                  <span class="text-xs text-muted-foreground">State</span>
                  <p class="text-sm mt-1">{{ mockData.active ? 'Active' : 'Disabled' }}</p>
                </div>
              </div>

              <div v-if="mockData.headers?.length">
                <span class="text-xs text-muted-foreground">Headers</span>
                <div class="mt-1 space-y-1">
                  <div v-for="(h, i) in mockData.headers" :key="i" class="font-mono text-xs">
                    <span class="text-muted-foreground">{{ h.name }}:</span> {{ h.value }}
                  </div>
                </div>
              </div>

              <div v-if="mockData.body !== undefined">
                <span class="text-xs text-muted-foreground">Body</span>
                <pre class="mt-1 text-xs font-mono bg-muted/50 rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-all">{{ mockData.body || '(empty)' }}</pre>
              </div>

              <div v-if="mockData.description">
                <span class="text-xs text-muted-foreground">Description</span>
                <p class="text-sm mt-1">{{ mockData.description }}</p>
              </div>

              <div>
                <span class="text-xs text-muted-foreground">Created</span>
                <p class="text-sm mt-1">{{ new Date(mockData.timestamp).toLocaleString() }}</p>
              </div>
            </div>
          </template>

          <!-- Blacklist Details -->
          <template v-else-if="selectedItem.type === 'blacklist' && blacklistData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">Component Name</span>
                <p class="font-mono text-sm mt-1">{{ blacklistData.name }}</p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Status</span>
                <p class="text-sm mt-1">{{ blacklistData.active ? 'Blocked' : 'Allowed' }}</p>
              </div>
            </div>
          </template>

          <!-- Favorite Details -->
          <template v-else-if="selectedItem.type === 'favorite' && favoriteData">
            <div class="space-y-3">
              <div>
                <span class="text-xs text-muted-foreground">Component Name</span>
                <p class="font-mono text-sm mt-1">{{ favoriteData.name }}</p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Element</span>
                <p class="font-mono text-sm mt-1">
                  {{ favoriteData.tagName }}{{ favoriteData.className ? '.' + favoriteData.className : '' }}
                </p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">Added</span>
                <p class="text-sm mt-1">{{ new Date(favoriteData.timestamp).toLocaleString() }}</p>
              </div>
            </div>
          </template>

          <!-- Item was deleted -->
          <template v-else>
            <div class="text-center py-8 text-muted-foreground">
              Item no longer exists
            </div>
          </template>

        </div>
      </ScrollArea>
    </template>

    <!-- No selection -->
    <div v-else class="h-full flex items-center justify-center text-muted-foreground text-sm">
      Select an item to see details
    </div>
  </div>
</template>
