<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onUnmounted, defineAsyncComponent } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { ArrowLeft, Copy, Check, Send, MoreHorizontal } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/Textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import { NetworkActionsMenuContent } from '@/components/NetworkActionsMenu'
import NetworkHeaderRowMenuContent from '@/features/network/NetworkHeaderRowMenuContent.vue'
import NetworkHeaderValueCell from '@/features/network/NetworkHeaderValueCell.vue'
import HeaderLinkGroupNetworkPanel from '@/features/settings/components/HeaderLinkGroupNetworkPanel.vue'
import type { NetworkHeaderLinkRule, NetworkPinnedHeaderScope } from '@/types/inspector'
import {
  buildHeaderLinkUrl,
  findHeaderLinkRule,
  getEntryRequestHost,
  headersMatchingPinOrder,
  headersNotPinned,
  normalizeNetworkHeaderHost,
  pinnedHeaderOrderForScope,
  togglePinnedHeaderItem,
} from '@/utils/networkHeaderLinks'

/** Lazy load JsonEditor (Prism, tree) - only when user opens Request/Response tab */
const JsonEditor = defineAsyncComponent({
  loader: () => import('@/components/JsonEditor.vue'),
  loadingComponent: {
    template: '<div class="flex items-center justify-center h-full text-sm text-muted-foreground">Loading...</div>'
  },
  delay: 100
})
import type { NetworkEntry } from '@/types/network'
import { getStatusCategory, formatBytes, formatDuration } from '@/types/network'
import { copyToClipboard } from '@/utils/networkUtils'
import { useInspectorSettingsSync } from '@/settings/useInspectorSettings'
import { useCurlCopy } from '@/composables/useCurlCopy'
import type { BaseInspectorSettings, BreakpointWithStatus, MockWithStatus } from '@/types/inspector'
import { formatBodyForDisplay, detectLanguage } from './utils'
import {
  useBreakpointEditor,
  useFormDataEditor,
  type BreakpointEditData,
  type BreakpointDraftShape,
} from './composables'

type BodyFormatMode = 'raw' | 'form-data'

export type { BreakpointEditData }

export interface BreakpointDraft extends BreakpointDraftShape {}

const props = defineProps<{
  entry: NetworkEntry
  breakpointMode?: boolean
  breakpointTrigger?: 'request' | 'response'
  breakpointDraft?: BreakpointDraft | null
  breakpointMatchingIds?: Set<string>
  mockMatchingIds?: Set<string>
  allBreakpoints?: BreakpointWithStatus[]
  allMocks?: MockWithStatus[]
  headerLinkEditor?: { headerName: string; mode: 'create' | 'edit' } | null
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'cancelBreakpoint', entryId: string): void
  (e: 'applyBreakpoint', data: BreakpointEditData): void
  (e: 'updateDraft', updates: Partial<BreakpointDraft>): void
  (e: 'copyCurl', entry: NetworkEntry): void
  (e: 'setBreakpoint', entry: NetworkEntry): void
  (e: 'mockResponse', entry: NetworkEntry): void
  (e: 'toggleBreakpoint', entry: NetworkEntry): void
  (e: 'deleteBreakpoint', entry: NetworkEntry): void
  (e: 'toggleMock', entry: NetworkEntry): void
  (e: 'deleteMock', entry: NetworkEntry): void
  (e: 'openHeaderLinkEditor', payload: { headerName: string; mode: 'create' | 'edit' }): void
  (e: 'closeHeaderLinkEditor'): void
}>()

// ============================================================================
// Composables
// ============================================================================

const emitUpdateDraft = (updates: Partial<BreakpointDraft>) => emit('updateDraft', updates)

const formData = useFormDataEditor({
  entry: () => props.entry,
  emitUpdateDraft,
  editableRequestBody: () => editor.editableRequestBody.value,
  settings: () => settings.value,
})

const editor = useBreakpointEditor({
  entry: () => props.entry,
  breakpointMode: () => props.breakpointMode,
  breakpointTrigger: () => props.breakpointTrigger,
  breakpointDraft: () => props.breakpointDraft,
  emitUpdateDraft,
  bodyFormatMode: formData.bodyFormatMode,
  editableFormData: formData.editableFormData,
  serializeFormDataToDraft: formData.serializeFormDataToDraft,
})

const {
  activeSection,
  editableMethod, editableScheme, editableHost, editablePath,
  editableParams, editableRequestHeaders, editableResponseHeaders,
  editableRequestBody, editableResponseBody,
  canEditRequest, canEditResponse, methodAllowsBody,
  displayMethod, displayUrl, fullUrlPreview,
  updateUrlField, updateRequestHeader, updateResponseHeader,
  updateParam, addParam, removeParam, removeAllParams,
  addRequestHeader, removeRequestHeader, removeAllRequestHeaders,
  updateRequestBody, updateResponseBody,
  buildApplyData,
} = editor

const {
  bodyFormatMode, editableFormData, copiedFormDataIndex,
  isFormDataBody, readonlyFormData, hasFileOptions,
  updateFormDataField, addFormDataEntry, removeFormDataEntry,
  removeAllFormDataEntries, copyFormDataValue, handleBodyFormatChange,
  handleFileSelected, getFileDisplayLabel,
  getFileOptions, getSelectedFileOption, selectFileOption,
} = formData

// ============================================================================
// Local UI state
// ============================================================================

const settings = useInspectorSettingsSync()
const jsonMode = ref<'text' | 'tree'>('text')
const copiedHeaderIndex = ref<number | null>(null)
const copiedResponseHeaderIndex = ref<number | null>(null)
/** Read-only Advanced header row copy feedback (req:/res: + lowercase name) */
const copiedHeaderKey = ref<string | null>(null)
const { curlCopied, copyCurl: copyCurlCommand } = useCurlCopy()

const urlRef = ref<HTMLElement | null>(null)
const urlContainerRef = ref<HTMLElement | null>(null)
const isUrlTruncated = ref(false)

function checkUrlTruncation() {
  if (!urlRef.value) return
  isUrlTruncated.value = urlRef.value.scrollWidth > urlRef.value.clientWidth
}

const debouncedCheckUrlTruncation = useDebounceFn(checkUrlTruncation, 50)

let urlResizeObserver: ResizeObserver | null = null

watch(settings, (s) => {
  if (s) jsonMode.value = s.json?.mode ?? 'text'
}, { immediate: true })

onMounted(() => {
  nextTick(() => {
    checkUrlTruncation()
    if (urlContainerRef.value) {
      urlResizeObserver = new ResizeObserver(() => debouncedCheckUrlTruncation())
      urlResizeObserver.observe(urlContainerRef.value)
    }
  })
})

onUnmounted(() => urlResizeObserver?.disconnect())

watch(
  () => ({ id: props.entry?.id, url: displayUrl.value }),
  () => nextTick(checkUrlTruncation),
  { immediate: false }
)

// ============================================================================
// Computed
// ============================================================================

type SectionId = 'url' | 'params' | 'headers' | 'request' | 'response'

const sections = computed<Array<{ id: SectionId; label: string }>>(() => {
  const baseSections: Array<{ id: SectionId; label: string }> = [
    { id: 'params', label: 'Params' },
    { id: 'headers', label: 'Headers' },
    { id: 'request', label: 'Request' },
    { id: 'response', label: 'Response' }
  ]
  if (canEditRequest.value) {
    return [{ id: 'url' as SectionId, label: 'URL' }, ...baseSections]
  }
  return baseSections
})

const statusClass = computed(() => {
  if (props.entry.pending) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
  const category = getStatusCategory(props.entry.status)
  switch (category) {
    case 'success': return 'bg-green-500/20 text-green-500 border-green-500/30'
    case 'redirect': return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    case 'client-error': return 'bg-orange-500/20 text-orange-500 border-orange-500/30'
    case 'server-error': return 'bg-red-500/20 text-red-500 border-red-500/30'
    default: return 'bg-red-500/20 text-red-500 border-red-500/30'
  }
})

const LARGE_BODY_THRESHOLD = 200 * 1024

const requestBodyJson = computed(() => {
  if (!props.entry.requestBody?.text) return ''
  if (isFormDataBody.value) return ''
  const raw = props.entry.requestBody.text
  if (raw.length > LARGE_BODY_THRESHOLD) return raw
  return formatBodyForDisplay(raw, props.entry.requestBody.contentType)
})

const responseBodyJson = computed(() => {
  if (!props.entry.responseBody?.text) return ''
  const raw = props.entry.responseBody.text
  if (raw.length > LARGE_BODY_THRESHOLD) return raw
  return formatBodyForDisplay(raw, props.entry.responseBody.contentType)
})

const requestBodyLanguage = computed(() =>
  detectLanguage(props.entry.requestBody?.contentType)
)

const responseBodyLanguage = computed(() =>
  detectLanguage(props.entry.responseBody?.contentType)
)

const entryHost = computed(() => getEntryRequestHost(props.entry.url))

const showAdvancedHeaderMenus = computed(
  () => settings.value?.networkCaptureMode === 'advanced'
)

const networkPinnedItems = computed(() => settings.value?.networkPinnedHeaders ?? [])

const networkPinnedOrderRequest = computed(() =>
  pinnedHeaderOrderForScope(networkPinnedItems.value, 'request'),
)

const networkPinnedOrderResponse = computed(() =>
  pinnedHeaderOrderForScope(networkPinnedItems.value, 'response'),
)

const pinnedRequestHeadersDisplay = computed(() =>
  headersMatchingPinOrder(props.entry.requestHeaders, networkPinnedOrderRequest.value),
)

const pinnedResponseHeadersDisplay = computed(() =>
  headersMatchingPinOrder(props.entry.responseHeaders, networkPinnedOrderResponse.value),
)

const unpinnedRequestHeadersReadonly = computed(() =>
  headersNotPinned(props.entry.requestHeaders, networkPinnedOrderRequest.value),
)

const unpinnedResponseHeadersReadonly = computed(() =>
  headersNotPinned(props.entry.responseHeaders, networkPinnedOrderResponse.value),
)

const showPinnedRequestSection = computed(
  () =>
    showAdvancedHeaderMenus.value &&
    !canEditRequest.value &&
    pinnedRequestHeadersDisplay.value.length > 0,
)

const showPinnedResponseSection = computed(
  () =>
    showAdvancedHeaderMenus.value &&
    !canEditResponse.value &&
    pinnedResponseHeadersDisplay.value.length > 0,
)

function headerLinkRuleFor(name: string): NetworkHeaderLinkRule | undefined {
  return findHeaderLinkRule(settings.value?.networkHeaderLinks, name, entryHost.value)
}

function isHeaderPinned(name: string, scope: NetworkPinnedHeaderScope): boolean {
  const pl = name.toLowerCase()
  return (settings.value?.networkPinnedHeaders ?? []).some(
    (p) => p.name.toLowerCase() === pl && p.scope === scope,
  )
}

function emitOpenHeaderLinkEditor(headerName: string, mode: 'create' | 'edit') {
  emit('openHeaderLinkEditor', { headerName, mode })
}

function deleteHeaderLinkById(id: string) {
  if (!settings.value?.networkHeaderLinks) return
  const i = settings.value.networkHeaderLinks.findIndex((r) => r.id === id)
  if (i !== -1) settings.value.networkHeaderLinks.splice(i, 1)
}

function openHeaderLinkUrl(rule: NetworkHeaderLinkRule, headerValue: string) {
  const url = buildHeaderLinkUrl(
    rule.urlTemplate,
    headerValue,
    rule.valueExtractRegex,
    rule.valueTransform,
  )
  window.open(url, '_blank', 'noopener,noreferrer')
}

function togglePinHeaderName(headerName: string, scope: NetworkPinnedHeaderScope) {
  if (!settings.value) return
  if (!Array.isArray(settings.value.networkPinnedHeaders)) {
    settings.value.networkPinnedHeaders = []
  }
  settings.value.networkPinnedHeaders = togglePinnedHeaderItem(
    settings.value.networkPinnedHeaders,
    headerName,
    scope,
  )
}

function isRequestHeaderPinned(name: string) {
  return isHeaderPinned(name, 'request')
}
function isResponseHeaderPinned(name: string) {
  return isHeaderPinned(name, 'response')
}
function toggleRequestPin(name: string) {
  togglePinHeaderName(name, 'request')
}
function toggleResponsePin(name: string) {
  togglePinHeaderName(name, 'response')
}

async function copyReadonlyHeaderValue(value: string, kind: 'req' | 'res', headerName: string) {
  const success = await copyToClipboard(value)
  if (success) {
    copiedHeaderKey.value = `${kind}:${headerName.toLowerCase()}`
    setTimeout(() => {
      copiedHeaderKey.value = null
    }, 2000)
  }
}

// ============================================================================
// Handlers
// ============================================================================

function handleBack() {
  if (props.headerLinkEditor) {
    emit('closeHeaderLinkEditor')
    return
  }
  if (props.breakpointMode) {
    emit('cancelBreakpoint', props.entry.id)
  } else {
    emit('back')
  }
}

useEscapeClose(computed(() => true), handleBack)

watch(
  () => props.headerLinkEditor,
  (ed) => {
    if (ed) activeSection.value = 'headers'
  },
)

function handleApplyBreakpoint() {
  if (!props.breakpointMode) return
  emit('applyBreakpoint', buildApplyData())
}

watch(
  () => ({ id: props.entry?.id, version: props.entry?.version ?? 1 }),
  (newVal, oldVal) => {
    if (!newVal.id) return
    if (newVal.id !== oldVal?.id) {
      curlCopied.value = false
      copiedHeaderIndex.value = null
      copiedResponseHeaderIndex.value = null
      copiedHeaderKey.value = null
      if (!props.breakpointMode) {
        activeSection.value = 'response'
      }
    }
  },
  { immediate: true }
)

async function copyHeaderValue(value: string, index: number, isResponse: boolean = false) {
  const success = await copyToClipboard(value)
  if (success) {
    if (isResponse) {
      copiedResponseHeaderIndex.value = index
      setTimeout(() => { copiedResponseHeaderIndex.value = null }, 2000)
    } else {
      copiedHeaderIndex.value = index
      setTimeout(() => { copiedHeaderIndex.value = null }, 2000)
    }
  }
}
</script>

<template>
  <TooltipProvider>
    <div class="h-full flex flex-col">
      <!-- Header (ПКМ открывает меню действий) -->
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <div class="shrink-0 flex items-center gap-3 p-3 border-b">
            <Button variant="ghost" size="icon" class="h-8 w-8" @click="handleBack">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        
        <div ref="urlContainerRef" class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <Badge variant="outline" class="font-mono text-xs" :class="{ 'text-amber-500 border-amber-500/50': breakpointMode && editableMethod !== entry.method }">
              {{ displayMethod }}
            </Badge>
            <Badge variant="outline" :class="statusClass" class="font-mono text-xs">
              {{ entry.pending ? '⏳ Pending' : entry.status }}
            </Badge>
            <span class="text-xs text-muted-foreground">
              {{ formatDuration(entry.duration) }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ formatBytes(entry.size) }}
            </span>
            <Badge v-if="breakpointMode" variant="outline" class="text-xs text-amber-500 border-amber-500/50">
              Breakpoint
            </Badge>
          </div>
          <Tooltip v-if="isUrlTruncated">
            <TooltipTrigger as-child>
              <div
                ref="urlRef"
                class="text-sm truncate text-muted-foreground cursor-default"
                :class="{ 'text-amber-500': breakpointMode && displayUrl !== entry.url }"
              >
                {{ displayUrl }}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" class="max-w-[90vw] break-all font-mono text-xs">
              {{ displayUrl }}
            </TooltipContent>
          </Tooltip>
          <div
            v-else
            ref="urlRef"
            class="text-sm truncate text-muted-foreground"
            :class="{ 'text-amber-500': breakpointMode && displayUrl !== entry.url }"
          >
            {{ displayUrl }}
          </div>
        </div>
        
        <!-- Copy as cURL button (desktop >= 1000px) -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="details-header-copy-curl h-8 shrink-0 text-xs gap-1.5 transition-colors"
              :class="{ 'text-green-500 border-green-500/50': curlCopied }"
              @click="copyCurlCommand(props.entry)"
            >
              <component :is="curlCopied ? Check : Copy" class="h-3.5 w-3.5" />
              {{ curlCopied ? 'Copied!' : 'Copy cURL' }}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Copy as cURL command (for Postman)
          </TooltipContent>
        </Tooltip>

        <!-- 3-dot actions menu (mobile < 1000px, same as table) -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              class="details-header-actions-menu h-8 w-8 shrink-0"
            >
              <MoreHorizontal class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <NetworkActionsMenuContent
            variant="dropdown"
            :entry="props.entry"
            :breakpoint-matching-ids="props.breakpointMatchingIds"
            :mock-matching-ids="props.mockMatchingIds"
            :all-breakpoints="props.allBreakpoints"
            :all-mocks="props.allMocks"
            @copy-curl="emit('copyCurl', $event)"
            @set-breakpoint="emit('setBreakpoint', $event)"
            @mock-response="emit('mockResponse', $event)"
            @toggle-breakpoint="emit('toggleBreakpoint', $event)"
            @delete-breakpoint="emit('deleteBreakpoint', $event)"
            @toggle-mock="emit('toggleMock', $event)"
            @delete-mock="emit('deleteMock', $event)"
          />
        </DropdownMenu>
        
        <!-- Apply button for breakpoint mode -->
        <Tooltip v-if="breakpointMode">
          <TooltipTrigger as-child>
            <Button
              variant="default"
              size="sm"
              class="h-8 shrink-0 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600"
              @click="handleApplyBreakpoint"
            >
              <Send class="h-3.5 w-3.5" />
              Apply
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Apply changes and continue request
          </TooltipContent>
        </Tooltip>
          </div>
        </ContextMenuTrigger>
        <NetworkActionsMenuContent
          variant="context"
          :entry="props.entry"
          :breakpoint-matching-ids="props.breakpointMatchingIds"
          :mock-matching-ids="props.mockMatchingIds"
          :all-breakpoints="props.allBreakpoints"
          :all-mocks="props.allMocks"
          @copy-curl="emit('copyCurl', $event)"
          @set-breakpoint="emit('setBreakpoint', $event)"
          @mock-response="emit('mockResponse', $event)"
          @toggle-breakpoint="emit('toggleBreakpoint', $event)"
          @delete-breakpoint="emit('deleteBreakpoint', $event)"
          @toggle-mock="emit('toggleMock', $event)"
          @delete-mock="emit('deleteMock', $event)"
        />
      </ContextMenu>
      
      <!-- Section tabs (Menubar style) -->
      <div class="shrink-0 flex items-center gap-1 p-1 border-b bg-muted/30">
        <button
          v-for="section in sections"
          :key="section.id"
          class="px-3 py-1.5 text-sm font-medium rounded-sm transition-colors"
          :class="{
            'bg-secondary text-secondary-foreground': activeSection === section.id,
            'hover:bg-secondary/50 text-muted-foreground': activeSection !== section.id
          }"
          @click="activeSection = section.id"
        >
          {{ section.label }}
        </button>
      </div>
      
      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <!-- URL Section (Breakpoint mode only) -->
        <ScrollArea v-if="activeSection === 'url' && canEditRequest" class="h-full">
          <div class="p-3 space-y-4">
            <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
              <p class="text-sm text-amber-600 dark:text-amber-400">
                Modify the URL components before sending the request. Changes will override the original request URL.
              </p>
            </div>
            
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label class="text-xs">Method</Label>
                <Input
                  :model-value="editableMethod"
                  @update:model-value="updateUrlField('method', String($event))"
                  placeholder="GET"
                  class="h-8 text-sm font-mono"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Scheme</Label>
                <Input
                  :model-value="editableScheme"
                  @update:model-value="updateUrlField('scheme', String($event))"
                  placeholder="https"
                  class="h-8 text-sm font-mono"
                />
              </div>
            </div>
            
            <div class="space-y-1.5">
              <Label class="text-xs">Host</Label>
              <Input
                :model-value="editableHost"
                @update:model-value="updateUrlField('host', String($event))"
                placeholder="api.example.com"
                class="h-8 text-sm font-mono"
              />
            </div>
            
            <div class="space-y-1.5">
              <Label class="text-xs">Path</Label>
              <Input
                :model-value="editablePath"
                @update:model-value="updateUrlField('path', String($event))"
                placeholder="/api/v1/users"
                class="h-8 text-sm font-mono"
              />
            </div>
            
            <!-- Preview -->
            <div class="p-3 bg-muted/50 rounded-md">
              <Label class="text-xs text-muted-foreground">URL Preview (includes query params)</Label>
              <div class="font-mono text-sm mt-1 break-all">
                {{ fullUrlPreview }}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <!-- Params Section -->
        <ScrollArea v-else-if="activeSection === 'params'" class="h-full">
          <div class="p-3 space-y-3">
            <!-- Add/Remove buttons for edit mode -->
            <div v-if="canEditRequest" class="flex items-center justify-between">
              <span class="text-sm font-semibold">Query Parameters</span>
              <div class="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  class="h-7 text-xs text-destructive_text hover:text-destructive_text" 
                  :disabled="editableParams.length === 0"
                  @click="removeAllParams"
                >
                  Remove all
                </Button>
                <Button variant="outline" size="sm" class="h-7 text-xs" @click="addParam">
                  Add Param
                </Button>
              </div>
            </div>
            
            <div v-if="(canEditRequest ? editableParams : entry.params).length === 0" class="text-sm text-muted-foreground text-center py-8">
              No query parameters
            </div>
            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-1/3">Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead v-if="canEditRequest" class="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="canEditRequest">
                  <TableRow v-for="(param, index) in editableParams" :key="index">
                    <TableCell class="py-2 align-top">
                      <Input
                        :model-value="param.key"
                        @update:model-value="updateParam(index, 'key', $event)"
                        class="h-7 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell class="py-2 align-top">
                      <Input
                        :model-value="param.value"
                        @update:model-value="updateParam(index, 'value', $event)"
                        class="h-7 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell class="py-2 text-center align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-6 w-6 p-0 text-destructive_text hover:text-destructive_text"
                        @click="removeParam(index)"
                      >
                        ×
                      </Button>
                    </TableCell>
                  </TableRow>
                </template>
                <template v-else>
                  <TableRow v-for="(param, index) in entry.params" :key="index">
                    <TableCell class="font-mono text-xs py-2 align-top">{{ param.key }}</TableCell>
                    <TableCell class="font-mono text-xs py-2 break-all align-top">{{ param.value }}</TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
        
        <!-- Headers Section -->
        <ScrollArea v-else-if="activeSection === 'headers'" class="h-full">
          <div class="p-3 space-y-4">
            <HeaderLinkGroupNetworkPanel
              v-if="headerLinkEditor"
              :key="`${headerLinkEditor.headerName}:${headerLinkEditor.mode}`"
              :header-name="headerLinkEditor.headerName"
              :mode="headerLinkEditor.mode"
              :entry-host="getEntryRequestHost(entry.url)"
              @close="emit('closeHeaderLinkEditor')"
            />
            <!-- Pinned Request Headers -->
            <div v-if="showPinnedRequestSection" class="space-y-2">
              <h4 class="text-sm font-semibold">Pinned Request Headers</h4>
              <Table class="network-headers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead class="w-10 text-center">
                      <span v-if="showAdvancedHeaderMenus" />
                      <span v-else>Copy</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-if="showAdvancedHeaderMenus">
                    <ContextMenu
                      v-for="(header, index) in pinnedRequestHeadersDisplay"
                      :key="`preq-${header.name}-${index}`"
                    >
                      <ContextMenuTrigger as-child>
                        <TableRow>
                          <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                          <TableCell class="font-mono text-xs py-2 align-top">
                            <NetworkHeaderValueCell
                              :value="header.value"
                              :link-rule="headerLinkRuleFor(header.name)"
                            />
                          </TableCell>
                          <TableCell class="py-2 text-center align-top">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  class="h-6 w-6 p-0 transition-colors"
                                  :class="{ 'text-green-500': copiedHeaderKey === `req:${header.name.toLowerCase()}` }"
                                  @click.stop
                                >
                                  <MoreHorizontal class="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <NetworkHeaderRowMenuContent
                                variant="dropdown"
                                :link-rule-id="headerLinkRuleFor(header.name)?.id ?? null"
                                :is-pinned="isRequestHeaderPinned(header.name)"
                                :can-open-link="!!header.value && !!headerLinkRuleFor(header.name)"
                                @copy="copyReadonlyHeaderValue(header.value, 'req', header.name)"
                                @create-link="emitOpenHeaderLinkEditor(header.name, 'create')"
                                @open-link="openHeaderLinkUrl(headerLinkRuleFor(header.name)!, header.value)"
                                @edit-link="emitOpenHeaderLinkEditor(header.name, 'edit')"
                                @delete-link="deleteHeaderLinkById(headerLinkRuleFor(header.name)!.id)"
                                @toggle-pin="toggleRequestPin(header.name)"
                              />
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <NetworkHeaderRowMenuContent
                        variant="context"
                        :link-rule-id="headerLinkRuleFor(header.name)?.id ?? null"
                        :is-pinned="isRequestHeaderPinned(header.name)"
                        :can-open-link="!!header.value && !!headerLinkRuleFor(header.name)"
                        @copy="copyReadonlyHeaderValue(header.value, 'req', header.name)"
                        @create-link="emitOpenHeaderLinkEditor(header.name, 'create')"
                        @open-link="openHeaderLinkUrl(headerLinkRuleFor(header.name)!, header.value)"
                        @edit-link="emitOpenHeaderLinkEditor(header.name, 'edit')"
                        @delete-link="deleteHeaderLinkById(headerLinkRuleFor(header.name)!.id)"
                        @toggle-pin="toggleRequestPin(header.name)"
                      />
                    </ContextMenu>
                  </template>
                  <template v-else>
                    <TableRow v-for="(header, index) in pinnedRequestHeadersDisplay" :key="`preq-copy-${index}`">
                      <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                      <TableCell class="font-mono text-xs py-2 align-top">
                        <NetworkHeaderValueCell
                          :value="header.value"
                          :link-rule="headerLinkRuleFor(header.name)"
                        />
                      </TableCell>
                      <TableCell class="py-2 text-center align-top">
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0 transition-colors"
                          :class="{ 'text-green-500': copiedHeaderKey === `req:${header.name.toLowerCase()}` }"
                          @click="copyReadonlyHeaderValue(header.value, 'req', header.name)"
                        >
                          <component :is="copiedHeaderKey === `req:${header.name.toLowerCase()}` ? Check : Copy" class="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </template>
                </TableBody>
              </Table>
            </div>

            <!-- Pinned Response Headers -->
            <div v-if="showPinnedResponseSection" class="space-y-2">
              <h4 class="text-sm font-semibold">Pinned Response Headers</h4>
              <Table class="network-headers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead class="w-10 text-center">
                      <span v-if="showAdvancedHeaderMenus" />
                      <span v-else>Copy</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-if="showAdvancedHeaderMenus">
                    <ContextMenu
                      v-for="(header, index) in pinnedResponseHeadersDisplay"
                      :key="`pres-${header.name}-${index}`"
                    >
                      <ContextMenuTrigger as-child>
                        <TableRow>
                          <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                          <TableCell class="font-mono text-xs py-2 align-top">
                            <NetworkHeaderValueCell
                              :value="header.value"
                              :link-rule="headerLinkRuleFor(header.name)"
                            />
                          </TableCell>
                          <TableCell class="py-2 text-center align-top">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  class="h-6 w-6 p-0 transition-colors"
                                  :class="{ 'text-green-500': copiedHeaderKey === `res:${header.name.toLowerCase()}` }"
                                  @click.stop
                                >
                                  <MoreHorizontal class="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <NetworkHeaderRowMenuContent
                                variant="dropdown"
                                :link-rule-id="headerLinkRuleFor(header.name)?.id ?? null"
                                :is-pinned="isResponseHeaderPinned(header.name)"
                                :can-open-link="!!header.value && !!headerLinkRuleFor(header.name)"
                                @copy="copyReadonlyHeaderValue(header.value, 'res', header.name)"
                                @create-link="emitOpenHeaderLinkEditor(header.name, 'create')"
                                @open-link="openHeaderLinkUrl(headerLinkRuleFor(header.name)!, header.value)"
                                @edit-link="emitOpenHeaderLinkEditor(header.name, 'edit')"
                                @delete-link="deleteHeaderLinkById(headerLinkRuleFor(header.name)!.id)"
                                @toggle-pin="toggleResponsePin(header.name)"
                              />
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <NetworkHeaderRowMenuContent
                        variant="context"
                        :link-rule-id="headerLinkRuleFor(header.name)?.id ?? null"
                        :is-pinned="isResponseHeaderPinned(header.name)"
                        :can-open-link="!!header.value && !!headerLinkRuleFor(header.name)"
                        @copy="copyReadonlyHeaderValue(header.value, 'res', header.name)"
                        @create-link="emitOpenHeaderLinkEditor(header.name, 'create')"
                        @open-link="openHeaderLinkUrl(headerLinkRuleFor(header.name)!, header.value)"
                        @edit-link="emitOpenHeaderLinkEditor(header.name, 'edit')"
                        @delete-link="deleteHeaderLinkById(headerLinkRuleFor(header.name)!.id)"
                        @toggle-pin="toggleResponsePin(header.name)"
                      />
                    </ContextMenu>
                  </template>
                  <template v-else>
                    <TableRow v-for="(header, index) in pinnedResponseHeadersDisplay" :key="`pres-copy-${index}`">
                      <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                      <TableCell class="font-mono text-xs py-2 align-top">
                        <NetworkHeaderValueCell
                          :value="header.value"
                          :link-rule="headerLinkRuleFor(header.name)"
                        />
                      </TableCell>
                      <TableCell class="py-2 text-center align-top">
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0 transition-colors"
                          :class="{ 'text-green-500': copiedHeaderKey === `res:${header.name.toLowerCase()}` }"
                          @click="copyReadonlyHeaderValue(header.value, 'res', header.name)"
                        >
                          <component :is="copiedHeaderKey === `res:${header.name.toLowerCase()}` ? Check : Copy" class="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </template>
                </TableBody>
              </Table>
            </div>

            <!-- Request Headers -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-semibold">Request Headers</h4>
                <div v-if="canEditRequest" class="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    class="h-7 text-xs text-destructive_text hover:text-destructive_text" 
                    :disabled="editableRequestHeaders.length === 0"
                    @click="removeAllRequestHeaders"
                  >
                    Remove all
                  </Button>
                  <Button variant="outline" size="sm" class="h-7 text-xs" @click="addRequestHeader">
                    Add Header
                  </Button>
                </div>
              </div>
              <div
                v-if="canEditRequest ? editableRequestHeaders.length === 0 : entry.requestHeaders.length === 0"
                class="text-sm text-muted-foreground"
              >
                No request headers
              </div>
              <Table v-else-if="canEditRequest" class="network-headers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead class="w-10 text-center" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(header, index) in editableRequestHeaders" :key="index">
                    <TableCell class="py-2 align-top">
                      <Input
                        :model-value="header.name"
                        @update:model-value="updateRequestHeader(index, 'name', $event)"
                        placeholder="Header name"
                        class="h-7 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell class="py-2 align-top">
                      <Input
                        :model-value="header.value"
                        @update:model-value="updateRequestHeader(index, 'value', $event)"
                        placeholder="Header value"
                        class="h-7 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell class="py-2 text-center align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-6 w-6 p-0 text-destructive_text hover:text-destructive_text"
                        @click="removeRequestHeader(index)"
                      >
                        ×
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Table v-else-if="unpinnedRequestHeadersReadonly.length > 0" class="network-headers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead class="w-10 text-center">
                      <span v-if="showAdvancedHeaderMenus" />
                      <span v-else>Copy</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-if="showAdvancedHeaderMenus">
                    <ContextMenu
                      v-for="(header, index) in unpinnedRequestHeadersReadonly"
                      :key="`req-${header.name}-${index}`"
                    >
                      <ContextMenuTrigger as-child>
                        <TableRow>
                          <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                          <TableCell class="font-mono text-xs py-2 align-top">
                            <NetworkHeaderValueCell
                              :value="header.value"
                              :link-rule="headerLinkRuleFor(header.name)"
                            />
                          </TableCell>
                          <TableCell class="py-2 text-center align-top">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  class="h-6 w-6 p-0 transition-colors"
                                  :class="{ 'text-green-500': copiedHeaderKey === `req:${header.name.toLowerCase()}` }"
                                  @click.stop
                                >
                                  <MoreHorizontal class="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <NetworkHeaderRowMenuContent
                                variant="dropdown"
                                :link-rule-id="headerLinkRuleFor(header.name)?.id ?? null"
                                :is-pinned="isRequestHeaderPinned(header.name)"
                                :can-open-link="!!header.value && !!headerLinkRuleFor(header.name)"
                                @copy="copyReadonlyHeaderValue(header.value, 'req', header.name)"
                                @create-link="emitOpenHeaderLinkEditor(header.name, 'create')"
                                @open-link="openHeaderLinkUrl(headerLinkRuleFor(header.name)!, header.value)"
                                @edit-link="emitOpenHeaderLinkEditor(header.name, 'edit')"
                                @delete-link="deleteHeaderLinkById(headerLinkRuleFor(header.name)!.id)"
                                @toggle-pin="toggleRequestPin(header.name)"
                              />
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <NetworkHeaderRowMenuContent
                        variant="context"
                        :link-rule-id="headerLinkRuleFor(header.name)?.id ?? null"
                        :is-pinned="isRequestHeaderPinned(header.name)"
                        :can-open-link="!!header.value && !!headerLinkRuleFor(header.name)"
                        @copy="copyReadonlyHeaderValue(header.value, 'req', header.name)"
                        @create-link="emitOpenHeaderLinkEditor(header.name, 'create')"
                        @open-link="openHeaderLinkUrl(headerLinkRuleFor(header.name)!, header.value)"
                        @edit-link="emitOpenHeaderLinkEditor(header.name, 'edit')"
                        @delete-link="deleteHeaderLinkById(headerLinkRuleFor(header.name)!.id)"
                        @toggle-pin="toggleRequestPin(header.name)"
                      />
                    </ContextMenu>
                  </template>
                  <template v-else>
                    <TableRow v-for="(header, index) in unpinnedRequestHeadersReadonly" :key="index">
                      <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                      <TableCell class="font-mono text-xs py-2 align-top">
                        <NetworkHeaderValueCell
                          :value="header.value"
                          :link-rule="headerLinkRuleFor(header.name)"
                        />
                      </TableCell>
                      <TableCell class="py-2 text-center align-top">
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0 transition-colors"
                          :class="{ 'text-green-500': copiedHeaderIndex === index }"
                          @click="copyHeaderValue(header.value, index)"
                        >
                          <component :is="copiedHeaderIndex === index ? Check : Copy" class="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </template>
                </TableBody>
              </Table>
              <p
                v-else-if="!canEditRequest && entry.requestHeaders.length > 0 && unpinnedRequestHeadersReadonly.length === 0"
                class="text-sm text-muted-foreground"
              >
                All request headers are listed under Pinned Request Headers above.
              </p>
            </div>

            <!-- Response Headers -->
            <div>
              <h4 class="text-sm font-semibold mb-2">Response Headers</h4>
              <div
                v-if="(canEditResponse ? editableResponseHeaders : entry.responseHeaders).length === 0"
                class="text-sm text-muted-foreground"
              >
                {{ entry.pending ? 'Waiting for response...' : 'No response headers' }}
              </div>
              <Table v-else-if="canEditResponse" class="network-headers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead class="w-10 text-center" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(header, index) in editableResponseHeaders" :key="index">
                    <TableCell class="py-2 align-top">
                      <Input
                        :model-value="header.name"
                        @update:model-value="updateResponseHeader(index, 'name', $event)"
                        class="h-7 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell class="py-2 align-top">
                      <Input
                        :model-value="header.value"
                        @update:model-value="updateResponseHeader(index, 'value', $event)"
                        class="h-7 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell class="py-2 text-center align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-6 w-6 p-0 transition-colors"
                        :class="{ 'text-green-500': copiedResponseHeaderIndex === index }"
                        @click="copyHeaderValue(header.value, index, true)"
                      >
                        <component :is="copiedResponseHeaderIndex === index ? Check : Copy" class="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Table v-else-if="unpinnedResponseHeadersReadonly.length > 0" class="network-headers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead class="w-10 text-center">
                      <span v-if="showAdvancedHeaderMenus" />
                      <span v-else>Copy</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-if="showAdvancedHeaderMenus">
                    <ContextMenu
                      v-for="(header, index) in unpinnedResponseHeadersReadonly"
                      :key="`res-${header.name}-${index}`"
                    >
                      <ContextMenuTrigger as-child>
                        <TableRow>
                          <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                          <TableCell class="font-mono text-xs py-2 align-top">
                            <NetworkHeaderValueCell
                              :value="header.value"
                              :link-rule="headerLinkRuleFor(header.name)"
                            />
                          </TableCell>
                          <TableCell class="py-2 text-center align-top">
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  class="h-6 w-6 p-0 transition-colors"
                                  :class="{ 'text-green-500': copiedHeaderKey === `res:${header.name.toLowerCase()}` }"
                                  @click.stop
                                >
                                  <MoreHorizontal class="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <NetworkHeaderRowMenuContent
                                variant="dropdown"
                                :link-rule-id="headerLinkRuleFor(header.name)?.id ?? null"
                                :is-pinned="isResponseHeaderPinned(header.name)"
                                :can-open-link="!!header.value && !!headerLinkRuleFor(header.name)"
                                @copy="copyReadonlyHeaderValue(header.value, 'res', header.name)"
                                @create-link="emitOpenHeaderLinkEditor(header.name, 'create')"
                                @open-link="openHeaderLinkUrl(headerLinkRuleFor(header.name)!, header.value)"
                                @edit-link="emitOpenHeaderLinkEditor(header.name, 'edit')"
                                @delete-link="deleteHeaderLinkById(headerLinkRuleFor(header.name)!.id)"
                                @toggle-pin="toggleResponsePin(header.name)"
                              />
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <NetworkHeaderRowMenuContent
                        variant="context"
                        :link-rule-id="headerLinkRuleFor(header.name)?.id ?? null"
                        :is-pinned="isResponseHeaderPinned(header.name)"
                        :can-open-link="!!header.value && !!headerLinkRuleFor(header.name)"
                        @copy="copyReadonlyHeaderValue(header.value, 'res', header.name)"
                        @create-link="emitOpenHeaderLinkEditor(header.name, 'create')"
                        @open-link="openHeaderLinkUrl(headerLinkRuleFor(header.name)!, header.value)"
                        @edit-link="emitOpenHeaderLinkEditor(header.name, 'edit')"
                        @delete-link="deleteHeaderLinkById(headerLinkRuleFor(header.name)!.id)"
                        @toggle-pin="toggleResponsePin(header.name)"
                      />
                    </ContextMenu>
                  </template>
                  <template v-else>
                    <TableRow v-for="(header, index) in unpinnedResponseHeadersReadonly" :key="index">
                      <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                      <TableCell class="font-mono text-xs py-2 align-top">
                        <NetworkHeaderValueCell
                          :value="header.value"
                          :link-rule="headerLinkRuleFor(header.name)"
                        />
                      </TableCell>
                      <TableCell class="py-2 text-center align-top">
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0 transition-colors"
                          :class="{ 'text-green-500': copiedResponseHeaderIndex === index }"
                          @click="copyHeaderValue(header.value, index, true)"
                        >
                          <component :is="copiedResponseHeaderIndex === index ? Check : Copy" class="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </template>
                </TableBody>
              </Table>
              <p
                v-else-if="!canEditResponse && entry.responseHeaders.length > 0 && unpinnedResponseHeadersReadonly.length === 0"
                class="text-sm text-muted-foreground"
              >
                All response headers are shown in Pinned Response Headers at the top of this tab.
              </p>
            </div>
          </div>
        </ScrollArea>
        
        <!-- Request Body Section -->
        <div v-else-if="activeSection === 'request'" class="h-full flex flex-col">
          <!-- GET/HEAD methods cannot have body -->
          <div v-if="!methodAllowsBody" class="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
            <span>{{ displayMethod }} requests cannot have a body</span>
            <span v-if="canEditRequest" class="text-xs">(Change method in URL tab to add body)</span>
          </div>
          <div v-else-if="!entry.requestBody && !canEditRequest" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No request body
          </div>
          <template v-else>
            <!-- Header bar -->
            <div class="shrink-0 flex items-center justify-between px-3 py-2 border-b">
              <div class="flex items-center gap-2">
                <!-- Breakpoint mode: format selector -->
                <template v-if="canEditRequest && methodAllowsBody">
                  <Select :model-value="bodyFormatMode" @update:model-value="handleBodyFormatChange($event as BodyFormatMode)">
                    <SelectTrigger class="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw">raw</SelectItem>
                      <SelectItem value="form-data">form-data</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" class="text-xs text-amber-500 border-amber-500/50">
                    Editable
                  </Badge>
                </template>
                <!-- Read-only mode: just show content type -->
                <template v-else>
                  <span class="text-sm text-muted-foreground">
                    {{ entry.requestBody?.contentType || 'application/json' }}
                  </span>
                </template>
                <span v-if="entry.requestBody" class="text-xs text-muted-foreground">
                  ({{ formatBytes(entry.requestBody.originalSize) }})
                </span>
                <Badge v-if="entry.requestBody?.truncated" variant="outline" class="text-xs">
                  Truncated
                </Badge>
                <Badge v-if="entry.requestBody?.isBinary" variant="outline" class="text-xs">
                  Binary
                </Badge>
              </div>
            </div>
            
            <div v-if="entry.requestBody?.isBinary" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Binary content cannot be displayed
            </div>
            <!-- ======== Breakpoint EDIT mode ======== -->
            <template v-else-if="canEditRequest">
              <!-- form-data editor -->
              <ScrollArea v-if="bodyFormatMode === 'form-data'" class="flex-1">
                <div class="p-3 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold">Form Data</span>
                    <div class="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-7 text-xs text-destructive_text hover:text-destructive_text"
                        :disabled="editableFormData.length === 0"
                        @click="removeAllFormDataEntries"
                      >
                        Remove all
                      </Button>
                      <Button variant="outline" size="sm" class="h-7 text-xs" @click="addFormDataEntry">
                        Add Field
                      </Button>
                    </div>
                  </div>

                  <div v-if="editableFormData.length === 0" class="text-sm text-muted-foreground text-center py-8">
                    No form data fields
                  </div>
                  <Table v-else class="network-headers-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead class="w-[30%]">Key</TableHead>
                        <TableHead class="w-20">Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead class="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="(fd, index) in editableFormData" :key="index">
                        <TableCell class="py-2 align-top">
                          <Input
                            :model-value="fd.key"
                            @update:model-value="updateFormDataField(index, 'key', String($event))"
                            placeholder="Key"
                            class="h-7 text-xs font-mono"
                          />
                        </TableCell>
                        <TableCell class="py-2 align-top">
                          <Select :model-value="fd.type" @update:model-value="updateFormDataField(index, 'type', String($event))">
                            <SelectTrigger class="h-7 text-xs w-[72px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="file">File</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell class="py-2 align-top">
                          <Input
                            v-if="fd.type === 'text'"
                            :model-value="fd.value"
                            @update:model-value="updateFormDataField(index, 'value', String($event))"
                            placeholder="Value"
                            class="h-7 text-xs font-mono"
                          />
                          <div v-else class="flex items-center gap-1">
                            <Select
                              v-if="hasFileOptions"
                              :model-value="getSelectedFileOption(fd)"
                              @update:model-value="selectFileOption(index, String($event))"
                            >
                              <SelectTrigger class="h-7 text-xs font-mono flex-1">
                                <SelectValue :placeholder="getFileDisplayLabel(fd)">
                                  {{ getFileDisplayLabel(fd) }}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  v-for="opt in getFileOptions(fd)"
                                  :key="opt.id"
                                  :value="opt.id"
                                >
                                  {{ opt.label }}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <span
                              v-else
                              class="flex-1 truncate text-xs font-mono px-2 h-7 flex items-center border rounded-md bg-background"
                            >
                              {{ getFileDisplayLabel(fd) }}
                            </span>
                            <label class="shrink-0 inline-flex items-center justify-center h-7 px-2 text-xs rounded-md border cursor-pointer hover:bg-muted/50 transition-colors">
                              Browse
                              <input
                                type="file"
                                class="sr-only"
                                @change="handleFileSelected($event, index)"
                              />
                            </label>
                          </div>
                        </TableCell>
                        <TableCell class="py-2 text-center align-top">
                          <Button
                            variant="ghost"
                            size="sm"
                            class="h-6 w-6 p-0 text-destructive_text hover:text-destructive_text"
                            @click="removeFormDataEntry(index)"
                          >
                            ×
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
              <!-- raw body editor -->
              <div v-else class="flex-1 min-h-0">
                <JsonEditor
                  :model-value="editableRequestBody"
                  @update:model-value="updateRequestBody"
                  :editable="true"
                  :show-copy="true"
                  :mode="jsonMode"
                  :language="requestBodyLanguage"
                  :full-height="true"
                  class="h-full"
                />
              </div>
            </template>
            <!-- ======== Read-only mode ======== -->
            <template v-else>
              <!-- Form-data read-only table -->
              <ScrollArea v-if="isFormDataBody" class="flex-1">
                <div class="p-3">
                  <Table class="network-headers-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead class="w-[30%]">Key</TableHead>
                        <TableHead class="w-16">Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead class="w-10 text-center">Copy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="(fd, index) in readonlyFormData" :key="index">
                        <TableCell class="font-mono text-xs py-2 align-top">{{ fd.key }}</TableCell>
                        <TableCell class="font-mono text-xs py-2 align-top text-muted-foreground">
                          {{ fd.type === 'file' ? 'File' : 'Text' }}
                        </TableCell>
                        <TableCell class="font-mono text-xs py-2 break-all align-top whitespace-pre-wrap">
                          <template v-if="fd.type === 'file'">
                            <span class="text-muted-foreground">{{ fd.fileName || '(binary)' }}</span>
                            <span v-if="fd.fileSize" class="text-muted-foreground ml-1">({{ formatBytes(fd.fileSize) }})</span>
                          </template>
                          <template v-else>{{ fd.value }}</template>
                        </TableCell>
                        <TableCell class="py-2 text-center align-top">
                          <Button
                            variant="ghost"
                            size="sm"
                            class="h-6 w-6 p-0 transition-colors"
                            :class="{ 'text-green-500': copiedFormDataIndex === index }"
                            @click="copyFormDataValue(fd, index)"
                          >
                            <component :is="copiedFormDataIndex === index ? Check : Copy" class="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
              <!-- Body read-only -->
              <div v-else class="flex-1 min-h-0">
                <JsonEditor
                  :model-value="requestBodyJson"
                  :editable="false"
                  :show-copy="true"
                  :mode="jsonMode"
                  :language="requestBodyLanguage"
                  :full-height="true"
                  class="h-full"
                />
              </div>
            </template>
          </template>
        </div>
        
        <!-- Response Body Section -->
        <div v-else-if="activeSection === 'response'" class="h-full flex flex-col">
          <div v-if="entry.pending && !canEditResponse" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Waiting for response...
          </div>
          <div v-else-if="entry.error && !canEditResponse" class="flex-1 flex items-center justify-center text-sm text-destructive_text">
            {{ entry.error }}
          </div>
          <div v-else-if="!entry.responseBody && !canEditResponse" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No response body
          </div>
          <template v-else>
            <div class="shrink-0 flex items-center justify-between px-3 py-2 border-b">
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">
                  {{ entry.responseBody?.contentType || 'application/json' }}
                </span>
                <span v-if="entry.responseBody" class="text-xs text-muted-foreground">
                  ({{ formatBytes(entry.responseBody.originalSize) }})
                </span>
                <Badge v-if="entry.responseBody?.truncated" variant="outline" class="text-xs">
                  Truncated
                </Badge>
                <Badge v-if="entry.responseBody?.isBinary" variant="outline" class="text-xs">
                  Binary
                </Badge>
                <Badge v-if="canEditResponse" variant="outline" class="text-xs text-amber-500 border-amber-500/50">
                  Editable
                </Badge>
              </div>
            </div>
            
            <div v-if="entry.responseBody?.isBinary" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Binary content cannot be displayed
            </div>
            <div v-else class="flex-1 min-h-0">
              <JsonEditor
                v-if="canEditResponse"
                :model-value="editableResponseBody"
                @update:model-value="updateResponseBody"
                :editable="true"
                :show-copy="true"
                :mode="jsonMode"
                :language="responseBodyLanguage"
                :full-height="true"
                class="h-full"
              />
              <JsonEditor
                v-else
                :model-value="responseBodyJson"
                :editable="false"
                :show-copy="true"
                :mode="jsonMode"
                :language="responseBodyLanguage"
                :full-height="true"
                class="h-full"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

  </TooltipProvider>
</template>

<style scoped>
/* Headers table - align name column to top */
.network-headers-table :deep(td) {
  vertical-align: top;
}

/* Prevent line breaks being added when copying text */
.network-headers-table :deep(td) {
  white-space: pre-wrap;
  word-break: break-all;
}

/* Single-screen mode (<1000px): Copy cURL → 3-dot menu */
@media (max-width: 999px) {
  .details-header-copy-curl {
    display: none !important;
  }
}

@media (min-width: 1000px) {
  .details-header-actions-menu {
    display: none !important;
  }
}
</style>
