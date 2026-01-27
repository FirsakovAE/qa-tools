<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import type { NetworkEntry } from '@/types/network'
import type { MockRule, MockHeaderEntry } from '@/types/inspector'

const props = defineProps<{
  open: boolean
  entry: NetworkEntry | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', mock: MockRule): void
  (e: 'cancel'): void
}>()

// Make open truly controllable with v-model
const openProxy = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

// Active tab
const activeTab = ref('response')

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

// Function to format JSON for editing
function formatJson(text: string | undefined | null): string {
  if (!text) return '{}'
  try {
    const parsed = JSON.parse(text)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return text
  }
}

// Function to fill form from entry
function fillFromEntry(entry: NetworkEntry) {
  // Parse URL
  try {
    const url = new URL(entry.url)
    scheme.value = url.protocol.replace(':', '')
    host.value = url.hostname
    port.value = url.port || ''
    path.value = url.pathname || '/'
    query.value = url.search ? url.search.substring(1) : ''
  } catch {
    scheme.value = 'https'
    host.value = ''
    port.value = ''
    path.value = '/'
    query.value = ''
  }
  
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

// Watch for dialog opening
watch(() => props.open, (isOpen, wasOpen) => {
  if (isOpen && !wasOpen && props.entry) {
    fillFromEntry(props.entry)
    activeTab.value = 'response'
  } else if (!isOpen) {
    // Reset form
    scheme.value = ''
    host.value = ''
    port.value = ''
    path.value = ''
    query.value = ''
    method.value = ''
    status.value = 200
    statusText.value = 'OK'
    responseBody.value = '{}'
    responseHeaders.value = []
    delay.value = 0
    description.value = ''
  }
}, { immediate: false })

// Watch for entry changes (when dialog is already open)
watch(() => props.entry, (entry, prevEntry) => {
  if (props.open && entry && entry !== prevEntry) {
    fillFromEntry(entry)
  }
}, { immediate: false })

// Add/remove header
function addHeader() {
  responseHeaders.value.push({ name: '', value: '' })
}

function removeHeader(index: number) {
  responseHeaders.value.splice(index, 1)
}

// Handle confirm
const handleConfirm = () => {
  if (!props.entry || !isValid.value) return
  
  const mock: MockRule = {
    id: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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
  emit('update:open', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:open', false)
}

// Validation
const isValid = computed(() => {
  return host.value.trim() !== '' && status.value >= 100 && status.value < 600
})

// Preview URL pattern
const urlPreview = computed(() => {
  let url = `${scheme.value || '*'}://${host.value || '*'}`
  if (port.value) url += `:${port.value}`
  url += path.value || '/*'
  if (query.value) url += `?${query.value}`
  return url
})
</script>

<template>
  <AlertDialog v-model:open="openProxy">
    <AlertDialogContent class="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
      <AlertDialogHeader class="shrink-0">
        <AlertDialogTitle class="flex items-center gap-2">
          <span>Create Mock Response</span>
          <Badge variant="outline" class="text-purple-500 border-purple-500/50">Map Local</Badge>
        </AlertDialogTitle>
        <AlertDialogDescription>
          This mock will intercept matching requests and return a fake response without hitting the network.
        </AlertDialogDescription>
      </AlertDialogHeader>
      
      <div class="flex-1 min-h-0 overflow-hidden py-4">
        <Tabs v-model="activeTab" class="h-full flex flex-col">
          <TabsList class="shrink-0 grid w-full grid-cols-3">
            <TabsTrigger value="matching">URL Matching</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
          </TabsList>
          
          <!-- URL Matching Tab -->
          <TabsContent value="matching" class="flex-1 overflow-y-auto mt-4 space-y-4">
            <div class="space-y-3">
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
          </TabsContent>
          
          <!-- Response Body Tab -->
          <TabsContent value="response" class="flex-1 overflow-hidden mt-4 flex flex-col gap-3">
            <div class="grid grid-cols-2 gap-3 shrink-0">
              <div class="space-y-1.5">
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
              <div class="space-y-1.5">
                <Label for="statusText" class="text-xs">Status Text</Label>
                <Input
                  id="statusText"
                  v-model="statusText"
                  placeholder="OK"
                  class="h-8 text-sm font-mono"
                />
              </div>
            </div>
            
            <div class="flex-1 min-h-0 flex flex-col">
              <Label for="responseBody" class="text-xs mb-1.5">Response Body (JSON)</Label>
              <Textarea
                id="responseBody"
                v-model="responseBody"
                placeholder='{"data": "mock response"}'
                class="flex-1 font-mono text-sm resize-none"
              />
            </div>
          </TabsContent>
          
          <!-- Headers Tab -->
          <TabsContent value="headers" class="flex-1 overflow-y-auto mt-4 space-y-3">
            <div class="flex items-center justify-between">
              <Label class="text-xs">Response Headers</Label>
              <Button variant="outline" size="sm" class="h-7 text-xs" @click="addHeader">
                Add Header
              </Button>
            </div>
            
            <div class="space-y-2">
              <div
                v-for="(header, index) in responseHeaders"
                :key="index"
                class="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
              >
                <Input
                  v-model="header.name"
                  placeholder="Header name"
                  class="h-8 text-sm font-mono"
                />
                <Input
                  v-model="header.value"
                  placeholder="Header value"
                  class="h-8 text-sm font-mono"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  @click="removeHeader(index)"
                >
                  ×
                </Button>
              </div>
            </div>
            
            <p class="text-xs text-muted-foreground">
              Common headers: Content-Type, Cache-Control, Access-Control-Allow-Origin
            </p>
          </TabsContent>
        </Tabs>
      </div>
      
      <AlertDialogFooter class="shrink-0">
        <AlertDialogCancel @click="handleCancel">Cancel</AlertDialogCancel>
        <Button
          @click="handleConfirm"
          :disabled="!isValid"
          class="bg-purple-500 hover:bg-purple-600"
        >
          Create Mock
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
