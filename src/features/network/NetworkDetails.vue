<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ArrowLeft, Copy, Check, Send, FileJson2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import JsonEditor from '@/components/JsonEditor.vue'
import type { NetworkEntry, HeaderEntry, UrlParam } from '@/types/network'
import { getStatusCategory, formatBytes, formatDuration } from '@/types/network'
import { copyToClipboard } from '@/utils/networkUtils'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { useCurlCopy } from '@/composables/useCurlCopy'
import type { BaseInspectorSettings } from '@/types/inspector'

export interface BreakpointEditData {
  entryId: string
  params: UrlParam[]
  requestHeaders: HeaderEntry[]
  requestBody: string | null
  responseHeaders: HeaderEntry[]
  responseBody: string | null
}

// Draft from NetworkTab - this is the SOURCE OF TRUTH for editing
export interface BreakpointDraft {
  entryId: string
  trigger: 'request' | 'response'
  params: Array<{ key: string; value: string }>
  requestHeaders: Array<{ name: string; value: string }>
  responseHeaders: Array<{ name: string; value: string }>
  requestBody: string
  responseBody: string
}

const props = defineProps<{
  entry: NetworkEntry
  breakpointMode?: boolean
  breakpointTrigger?: 'request' | 'response'
  breakpointDraft?: BreakpointDraft | null
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'applyBreakpoint', data: BreakpointEditData): void
  (e: 'updateDraft', updates: Partial<BreakpointDraft>): void
  (e: 'mockResponse', entry: NetworkEntry): void
}>()

// Active section (removed 'auth')
type SectionId = 'params' | 'headers' | 'request' | 'response'
const activeSection = ref<SectionId>('headers')

// JSON mode setting
const settings = ref<BaseInspectorSettings | null>(null)
const jsonMode = ref<'text' | 'tree'>('text')

// Copy states
const copiedHeaderIndex = ref<number | null>(null)
const copiedResponseHeaderIndex = ref<number | null>(null)

// cURL copy functionality
const { curlCopied, copyCurl: copyCurlCommand } = useCurlCopy()

// Editable state for breakpoint mode
const editableParams = ref<UrlParam[]>([])
const editableRequestHeaders = ref<HeaderEntry[]>([])
const editableResponseHeaders = ref<HeaderEntry[]>([])
const editableRequestBody = ref<string>('')
const editableResponseBody = ref<string>('')

// Helper to format JSON string for editing
function formatJsonForEdit(text: string | undefined | null): string {
  if (!text) return ''
  try {
    const parsed = JSON.parse(text)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return text
  }
}

// Initialize editable data from DRAFT (source of truth, isolated from entries[] updates)
watch(() => [props.breakpointDraft, props.breakpointMode, props.breakpointTrigger], () => {
  console.log('[NetworkDetails] Watch triggered:', { 
    breakpointMode: props.breakpointMode, 
    breakpointTrigger: props.breakpointTrigger,
    hasDraft: !!props.breakpointDraft,
    entryId: props.entry?.id
  })
  
  if (props.breakpointMode && props.breakpointDraft) {
    // Load from DRAFT - this is isolated from entries[] updates
    editableParams.value = JSON.parse(JSON.stringify(props.breakpointDraft.params || []))
    editableRequestHeaders.value = JSON.parse(JSON.stringify(props.breakpointDraft.requestHeaders || []))
    editableResponseHeaders.value = JSON.parse(JSON.stringify(props.breakpointDraft.responseHeaders || []))
    // Format JSON properly for editing
    editableRequestBody.value = formatJsonForEdit(props.breakpointDraft.requestBody)
    editableResponseBody.value = formatJsonForEdit(props.breakpointDraft.responseBody)
    
    console.log('[NetworkDetails] Loaded from draft:', {
      params: editableParams.value.length,
      requestHeaders: editableRequestHeaders.value.length,
      requestBody: editableRequestBody.value?.substring(0, 50)
    })
    
    // Set active section based on breakpoint trigger
    console.log('[NetworkDetails] Setting active section for trigger:', props.breakpointTrigger)
    if (props.breakpointTrigger === 'response') {
      activeSection.value = 'response'
    } else if (props.breakpointTrigger === 'request') {
      activeSection.value = 'request'
    }
  }
}, { immediate: true, deep: true })

// Whether we can edit request or response based on trigger
const canEditRequest = computed(() => {
  return props.breakpointMode && (props.breakpointTrigger === 'request' || props.breakpointTrigger === undefined)
})

const canEditResponse = computed(() => {
  return props.breakpointMode && props.breakpointTrigger === 'response'
})

// Handle apply breakpoint
function handleApplyBreakpoint() {
  if (!props.breakpointMode) return
  
  emit('applyBreakpoint', {
    entryId: props.entry.id,
    params: editableParams.value,
    requestHeaders: editableRequestHeaders.value,
    requestBody: editableRequestBody.value || null,
    responseHeaders: editableResponseHeaders.value,
    responseBody: editableResponseBody.value || null
  })
}

// Update header value and emit to parent draft
function updateRequestHeader(index: number, field: 'name' | 'value', newValue: string | number | undefined) {
  if (editableRequestHeaders.value[index]) {
    editableRequestHeaders.value[index][field] = String(newValue ?? '')
    // Emit update to parent draft
    emit('updateDraft', { requestHeaders: JSON.parse(JSON.stringify(editableRequestHeaders.value)) })
  }
}

function updateResponseHeader(index: number, field: 'name' | 'value', newValue: string | number | undefined) {
  if (editableResponseHeaders.value[index]) {
    editableResponseHeaders.value[index][field] = String(newValue ?? '')
    // Emit update to parent draft
    emit('updateDraft', { responseHeaders: JSON.parse(JSON.stringify(editableResponseHeaders.value)) })
  }
}

// Update param value and emit to parent draft
function updateParam(index: number, field: 'key' | 'value', newValue: string | number | undefined) {
  if (editableParams.value[index]) {
    editableParams.value[index][field] = String(newValue ?? '')
    // Emit update to parent draft
    emit('updateDraft', { params: JSON.parse(JSON.stringify(editableParams.value)) })
  }
}

// Update body and emit to parent draft
function updateRequestBody(value: string) {
  editableRequestBody.value = value
  emit('updateDraft', { requestBody: value })
}

function updateResponseBody(value: string) {
  editableResponseBody.value = value
  emit('updateDraft', { responseBody: value })
}

onMounted(async () => {
  try {
    settings.value = await useInspectorSettings()
    jsonMode.value = settings.value?.json?.mode ?? 'text'
  } catch { /* use defaults */ }
})

// Sections definition (removed Authorization)
const sections: Array<{ id: SectionId; label: string }> = [
  { id: 'params', label: 'Params' },
  { id: 'headers', label: 'Headers' },
  { id: 'request', label: 'Request' },
  { id: 'response', label: 'Response' }
]

// Status styling
const statusClass = computed(() => {
  if (props.entry.pending) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
  
  const category = getStatusCategory(props.entry.status)
  switch (category) {
    case 'success':
      return 'bg-green-500/20 text-green-500 border-green-500/30'
    case 'redirect':
      return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    case 'client-error':
      return 'bg-orange-500/20 text-orange-500 border-orange-500/30'
    case 'server-error':
      return 'bg-red-500/20 text-red-500 border-red-500/30'
    default:
      return 'bg-red-500/20 text-red-500 border-red-500/30'
  }
})

// ============================================================================
// Request/Response JSON for JsonEditor
// ============================================================================

const requestBodyJson = computed(() => {
  if (!props.entry.requestBody?.text) return '{}'
  try {
    const parsed = JSON.parse(props.entry.requestBody.text)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return props.entry.requestBody.text
  }
})

const responseBodyJson = computed(() => {
  if (!props.entry.responseBody?.text) return '{}'
  try {
    const parsed = JSON.parse(props.entry.responseBody.text)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return props.entry.responseBody.text
  }
})

// Extract x-request-id from response headers
const xRequestId = computed(() => {
  const header = props.entry.responseHeaders.find(
    h => h.name.toLowerCase() === 'x-request-id'
  )
  return header?.value || null
})

// Watch for entry changes (id change = different entry, version change = same entry updated)
watch(
  () => ({ id: props.entry?.id, version: props.entry?.version ?? 1 }),
  (newVal, oldVal) => {
    if (!newVal.id) return
    
    // Reset state on entry change (new entry selected)
    if (newVal.id !== oldVal?.id) {
      curlCopied.value = false
      copiedHeaderIndex.value = null
      copiedResponseHeaderIndex.value = null
      // Only reset to headers if NOT in breakpoint mode
      // In breakpoint mode, the other watch will set the correct tab
      if (!props.breakpointMode) {
        activeSection.value = 'headers'
      }
    }
  },
  { immediate: true }
)

// ============================================================================

// Copy header value with visual feedback
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
      <!-- Header -->
      <div class="shrink-0 flex items-center gap-3 p-3 border-b">
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('back')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <Badge variant="outline" class="font-mono text-xs">
              {{ entry.method }}
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
          </div>
          <div class="text-sm truncate text-muted-foreground" :title="entry.url">
            {{ entry.url }}
          </div>
        </div>
        
        <!-- Copy as cURL button with visual feedback -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="h-8 shrink-0 text-xs gap-1.5 transition-colors"
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
        
        <!-- Mock Response button (Map Local feature) -->
        <Tooltip v-if="!breakpointMode && entry.responseBody?.text">
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="h-8 shrink-0 text-xs gap-1.5 transition-colors text-purple-500 border-purple-500/50 hover:bg-purple-500/10"
              @click="emit('mockResponse', entry)"
            >
              <FileJson2 class="h-3.5 w-3.5" />
              Mock Response
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Create mock rule to return this response (Map Local)
          </TooltipContent>
        </Tooltip>
        
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
        <!-- Params Section -->
        <ScrollArea v-if="activeSection === 'params'" class="h-full">
          <div class="p-3">
            <div v-if="(canEditRequest ? editableParams : entry.params).length === 0" class="text-sm text-muted-foreground text-center py-8">
              No query parameters
            </div>
            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-1/3">Key</TableHead>
                  <TableHead>Value</TableHead>
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
            <!-- x-request-id badge if present -->
            <div v-if="xRequestId" class="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
              <Badge variant="outline" class="text-xs">x-request-id</Badge>
              <code class="text-xs font-mono flex-1 truncate" :title="xRequestId">{{ xRequestId }}</code>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 w-6 p-0 shrink-0"
                @click="copyToClipboard(xRequestId!)"
              >
                <Copy class="h-3 w-3" />
              </Button>
            </div>
            
            <!-- Request Headers -->
            <div>
              <h4 class="text-sm font-semibold mb-2">Request Headers</h4>
              <div v-if="(canEditRequest ? editableRequestHeaders : entry.requestHeaders).length === 0" class="text-sm text-muted-foreground">
                No request headers
              </div>
              <Table v-else class="network-headers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead class="w-10 text-center">Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-if="canEditRequest">
                    <TableRow v-for="(header, index) in editableRequestHeaders" :key="index">
                      <TableCell class="py-2 align-top">
                        <Input
                          :model-value="header.name"
                          @update:model-value="updateRequestHeader(index, 'name', $event)"
                          class="h-7 text-xs font-mono"
                        />
                      </TableCell>
                      <TableCell class="py-2 align-top">
                        <Input
                          :model-value="header.value"
                          @update:model-value="updateRequestHeader(index, 'value', $event)"
                          class="h-7 text-xs font-mono"
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
                  <template v-else>
                    <TableRow v-for="(header, index) in entry.requestHeaders" :key="index">
                      <TableCell class="font-mono text-xs py-2 align-top">{{ header.name }}</TableCell>
                      <TableCell class="font-mono text-xs py-2 break-all align-top whitespace-pre-wrap">{{ header.value }}</TableCell>
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
            </div>
            
            <!-- Response Headers -->
            <div>
              <h4 class="text-sm font-semibold mb-2">Response Headers</h4>
              <div v-if="(canEditResponse ? editableResponseHeaders : entry.responseHeaders).length === 0" class="text-sm text-muted-foreground">
                {{ entry.pending ? 'Waiting for response...' : 'No response headers' }}
              </div>
              <Table v-else class="network-headers-table">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead class="w-10 text-center">Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-if="canEditResponse">
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
                  </template>
                  <template v-else>
                    <TableRow 
                      v-for="(header, index) in entry.responseHeaders" 
                      :key="index"
                      :class="{ 'bg-blue-500/10': header.name.toLowerCase() === 'x-request-id' }"
                    >
                      <TableCell class="font-mono text-xs py-2 align-top">
                        <span :class="{ 'text-blue-500 font-semibold': header.name.toLowerCase() === 'x-request-id' }">
                          {{ header.name }}
                        </span>
                      </TableCell>
                      <TableCell class="font-mono text-xs py-2 break-all align-top whitespace-pre-wrap">{{ header.value }}</TableCell>
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
            </div>
          </div>
        </ScrollArea>
        
        <!-- Request Body Section -->
        <div v-else-if="activeSection === 'request'" class="h-full flex flex-col">
          <div v-if="!entry.requestBody && !canEditRequest" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No request body
          </div>
          <template v-else>
            <div class="shrink-0 flex items-center justify-between px-3 py-2 border-b">
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">
                  {{ entry.requestBody?.contentType || 'application/json' }}
                </span>
                <span v-if="entry.requestBody" class="text-xs text-muted-foreground">
                  ({{ formatBytes(entry.requestBody.originalSize) }})
                </span>
                <Badge v-if="entry.requestBody?.truncated" variant="outline" class="text-xs">
                  Truncated
                </Badge>
                <Badge v-if="entry.requestBody?.isBinary" variant="outline" class="text-xs">
                  Binary
                </Badge>
                <Badge v-if="canEditRequest" variant="outline" class="text-xs text-amber-500 border-amber-500/50">
                  Editable
                </Badge>
              </div>
            </div>
            
            <div v-if="entry.requestBody?.isBinary" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Binary content cannot be displayed
            </div>
            <div v-else class="flex-1 min-h-0">
              <JsonEditor
                v-if="canEditRequest"
                :model-value="editableRequestBody"
                @update:model-value="updateRequestBody"
                :editable="true"
                :show-copy="true"
                :mode="jsonMode"
                :full-height="true"
                class="h-full"
              />
              <JsonEditor
                v-else
                :model-value="requestBodyJson"
                :editable="false"
                :show-copy="true"
                :mode="jsonMode"
                :full-height="true"
                class="h-full"
              />
            </div>
          </template>
        </div>
        
        <!-- Response Body Section -->
        <div v-else-if="activeSection === 'response'" class="h-full flex flex-col">
          <div v-if="entry.pending && !canEditResponse" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Waiting for response...
          </div>
          <div v-else-if="entry.error && !canEditResponse" class="flex-1 flex items-center justify-center text-sm text-destructive">
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
                :full-height="true"
                class="h-full"
              />
              <JsonEditor
                v-else
                :model-value="responseBodyJson"
                :editable="false"
                :show-copy="true"
                :mode="jsonMode"
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
</style>
