<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ArrowLeft, Check, FileJson2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { NetworkEntry } from '@/types/network'
import type { MockRule, MockHeaderEntry, BaseInspectorSettings } from '@/types/inspector'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { parseUrl, buildUrlPreview, getStatusClass, formatJson, generateId } from './utils'

const props = defineProps<{
  entry: NetworkEntry
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'confirm', mock: MockRule): void
}>()

// Active section
type SectionId = 'matching' | 'response' | 'headers'
const activeSection = ref<SectionId>('response')

// JSON mode setting
const settings = ref<BaseInspectorSettings | null>(null)
const jsonMode = ref<'text' | 'tree'>('text')

// Load settings
watch(() => props.entry, async () => {
  try {
    settings.value = await useInspectorSettings()
    jsonMode.value = settings.value?.json?.mode ?? 'text'
  } catch { /* use defaults */ }
}, { immediate: true })

// URL Matching fields
const scheme = ref('')
const host = ref('')
const port = ref('')
const path = ref('')
const query = ref('')
const method = ref('')

// Response fields
const status = ref(200)
const statusText = ref('OK')
const responseBody = ref('')
const responseHeaders = ref<MockHeaderEntry[]>([])
const delay = ref(0)
const description = ref('')

// Function to fill form from entry
function fillFromEntry(entry: NetworkEntry) {
  // Parse URL
  const parsed = parseUrl(entry.url)
  scheme.value = parsed.scheme
  host.value = parsed.host
  port.value = parsed.port
  path.value = parsed.path
  query.value = parsed.query
  
  // Method
  method.value = entry.method
  
  // Response
  status.value = entry.status || 200
  statusText.value = entry.statusText || 'OK'
  responseBody.value = formatJson(entry.responseBody?.text)
  
  // Response headers
  responseHeaders.value = entry.responseHeaders.map(h => ({ name: h.name, value: h.value }))
  
  // Ensure content-type header exists
  const hasContentType = responseHeaders.value.some(h => h.name.toLowerCase() === 'content-type')
  if (!hasContentType) {
    responseHeaders.value.unshift({ name: 'Content-Type', value: 'application/json' })
  }
  
  delay.value = 0
  description.value = `Mock for ${entry.method} ${entry.path}`
}

// Watch for entry changes
watch(() => props.entry, (entry) => {
  if (entry) {
    fillFromEntry(entry)
    activeSection.value = 'response'
  }
}, { immediate: true })

// Add/remove header
function addHeader() {
  responseHeaders.value.push({ name: '', value: '' })
}

function removeHeader(index: number) {
  responseHeaders.value.splice(index, 1)
}

function removeAllHeaders() {
  responseHeaders.value = []
}

// Handle confirm
function handleConfirm() {
  if (!props.entry || !isValid.value) return
  
  const mock: MockRule = {
    id: generateId('mock'),
    enabled: true,
    scheme: scheme.value || undefined,
    host: host.value || undefined,
    port: port.value || undefined,
    path: path.value || undefined,
    query: query.value || undefined,
    method: method.value || undefined,
    status: status.value,
    statusText: statusText.value || 'OK',
    headers: responseHeaders.value.filter(h => h.name.trim() !== ''),
    body: responseBody.value,
    delay: delay.value > 0 ? delay.value : undefined,
    timestamp: new Date().toISOString(),
    description: description.value || undefined
  }
  
  emit('confirm', mock)
}

// Validation
const isValid = computed(() => {
  return host.value.trim() !== '' && status.value >= 100 && status.value < 600
})

// Preview URL pattern
const urlPreview = computed(() => {
  return buildUrlPreview(scheme.value, host.value, port.value, path.value, query.value)
})

// Status styling
const statusClass = computed(() => {
  return getStatusClass(props.entry.status, props.entry.pending)
})

// Section definitions
const sections: Array<{ id: SectionId; label: string }> = [
  { id: 'matching', label: 'URL Matching' },
  { id: 'response', label: 'Response' },
  { id: 'headers', label: 'Headers' }
]
</script>

<template>
  <TooltipProvider>
    <div class="h-full flex flex-col">
      <!-- Header (same style as NetworkDetails) -->
      <div class="shrink-0 flex items-center gap-3 p-3 border-b">
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('back')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <Badge variant="outline" class="text-purple-500 border-purple-500/50 gap-1">
              <FileJson2 class="h-3 w-3" />
              Mock Response
            </Badge>
            <Badge variant="outline" class="font-mono text-xs">
              {{ entry.method }}
            </Badge>
            <Badge variant="outline" :class="statusClass" class="font-mono text-xs">
              {{ entry.pending ? '⏳ Pending' : entry.status }}
            </Badge>
          </div>
          <div class="text-sm truncate text-muted-foreground" :title="entry.url">
            {{ entry.url }}
          </div>
        </div>
        
        <!-- Create Mock button -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="default"
              size="sm"
              class="h-8 shrink-0 text-xs gap-1.5 bg-purple-500 hover:bg-purple-600"
              :disabled="!isValid"
              @click="handleConfirm"
            >
              <Check class="h-3.5 w-3.5" />
              Create Mock
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Create mock rule to intercept matching requests
          </TooltipContent>
        </Tooltip>
      </div>
      
      <!-- Section tabs (Menubar style - same as NetworkDetails) -->
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
        <!-- URL Matching Section -->
        <ScrollArea v-if="activeSection === 'matching'" class="h-full">
          <div class="p-3 space-y-4">
            <div class="grid grid-cols-3 gap-3">
              <div class="space-y-1.5">
                <Label for="method" class="text-xs">Method</Label>
                <Input
                  id="method"
                  v-model="method"
                  placeholder="GET"
                  class="h-8 text-sm font-mono"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="scheme" class="text-xs">Scheme</Label>
                <Input
                  id="scheme"
                  v-model="scheme"
                  placeholder="https"
                  class="h-8 text-sm font-mono"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="port" class="text-xs">Port</Label>
                <Input
                  id="port"
                  v-model="port"
                  placeholder="443"
                  class="h-8 text-sm font-mono"
                />
              </div>
            </div>
            
            <div class="space-y-1.5">
              <Label for="host" class="text-xs">Host <span class="text-destructive">*</span></Label>
              <Input
                id="host"
                v-model="host"
                placeholder="api.example.com"
                class="h-8 text-sm font-mono"
              />
            </div>
            
            <div class="space-y-1.5">
              <Label for="path" class="text-xs">Path (supports * wildcard)</Label>
              <Input
                id="path"
                v-model="path"
                placeholder="/api/v1/users/*"
                class="h-8 text-sm font-mono"
              />
            </div>
            
            <div class="space-y-1.5">
              <Label for="query" class="text-xs">Query (optional)</Label>
              <Input
                id="query"
                v-model="query"
                placeholder="page=*"
                class="h-8 text-sm font-mono"
              />
            </div>
            
            <!-- Preview -->
            <div class="p-3 bg-muted/50 rounded-md">
              <Label class="text-xs text-muted-foreground">URL Pattern Preview</Label>
              <div class="font-mono text-sm mt-1 break-all">{{ urlPreview }}</div>
            </div>
            
            <!-- Options -->
            <div class="grid grid-cols-2 gap-3 pt-2 border-t">
              <div class="space-y-1.5">
                <Label for="delay" class="text-xs">Delay (ms)</Label>
                <Input
                  id="delay"
                  v-model.number="delay"
                  type="number"
                  :min="0"
                  placeholder="0"
                  class="h-8 text-sm font-mono"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="description" class="text-xs">Description</Label>
                <Input
                  id="description"
                  v-model="description"
                  placeholder="Mock for user API"
                  class="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <!-- Response Body Section -->
        <div v-else-if="activeSection === 'response'" class="h-full flex flex-col">
          <div class="shrink-0 flex items-center justify-between px-3 py-2 border-b">
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">Response Body (JSON)</span>
              <Badge variant="outline" class="text-xs text-purple-500 border-purple-500/50">
                Editable
              </Badge>
            </div>
          </div>
          
          <div class="shrink-0 grid grid-cols-2 gap-3 px-3 py-2 border-b">
            <div class="space-y-1">
              <Label for="status" class="text-xs">Status Code</Label>
              <Input
                id="status"
                v-model.number="status"
                type="number"
                :min="100"
                :max="599"
                class="h-8 text-sm font-mono"
              />
            </div>
            <div class="space-y-1">
              <Label for="statusText" class="text-xs">Status Text</Label>
              <Input
                id="statusText"
                v-model="statusText"
                placeholder="OK"
                class="h-8 text-sm font-mono"
              />
            </div>
          </div>
          
          <div class="flex-1 min-h-0">
            <JsonEditor
              v-model="responseBody"
              :editable="true"
              :show-copy="true"
              :mode="jsonMode"
              :full-height="true"
              class="h-full"
            />
          </div>
        </div>
        
        <!-- Headers Section -->
        <ScrollArea v-else-if="activeSection === 'headers'" class="h-full">
          <div class="p-3 space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold">Response Headers</h4>
              <div class="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  class="h-7 text-xs text-destructive hover:text-destructive" 
                  :disabled="responseHeaders.length === 0"
                  @click="removeAllHeaders"
                >
                  Remove all
                </Button>
                <Button variant="outline" size="sm" class="h-7 text-xs" @click="addHeader">
                  Add Header
                </Button>
              </div>
            </div>
            
            <div v-if="responseHeaders.length === 0" class="text-sm text-muted-foreground text-center py-8">
              No response headers
            </div>
            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-1/3">Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead class="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(header, index) in responseHeaders" :key="index">
                  <TableCell class="py-2 align-top">
                    <Input
                      v-model="header.name"
                      placeholder="Header name"
                      class="h-7 text-xs font-mono"
                    />
                  </TableCell>
                  <TableCell class="py-2 align-top">
                    <Input
                      v-model="header.value"
                      placeholder="Header value"
                      class="h-7 text-xs font-mono"
                    />
                  </TableCell>
                  <TableCell class="py-2 text-center align-top">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      @click="removeHeader(index)"
                    >
                      ×
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            <p class="text-xs text-muted-foreground">
              Common headers: Content-Type, Cache-Control, Access-Control-Allow-Origin
            </p>
          </div>
        </ScrollArea>
      </div>
    </div>
  </TooltipProvider>
</template>
