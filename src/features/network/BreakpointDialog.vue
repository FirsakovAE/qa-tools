<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { NetworkEntry } from '@/types/network'
import type { BreakpointItem, BreakpointTrigger } from '@/types/inspector'

const props = defineProps<{
  open: boolean
  entry: NetworkEntry | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', breakpoint: BreakpointItem): void
  (e: 'cancel'): void
}>()

// Make open truly controllable with v-model
const openProxy = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

// Form state - use v-model with reka-ui
const triggerRequest = ref(true)
const triggerResponse = ref(false)

// Parsed URL parts
const urlParts = computed(() => {
  if (!props.entry) {
    return { scheme: 'https', host: '', port: '', path: '/', query: '' }
  }
  
  try {
    const url = new URL(props.entry.url)
    return {
      scheme: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port || '',
      path: url.pathname || '/',
      query: url.search ? url.search.substring(1) : ''
    }
  } catch {
    return { scheme: 'https', host: '', port: '', path: '/', query: '' }
  }
})

// Editable fields (initialized from URL)
const scheme = ref('')
const host = ref('')
const port = ref('')
const path = ref('')
const query = ref('')

// Function to fill form from entry
function fillFromEntry(entry: NetworkEntry) {
  // Parse URL directly from entry to avoid reactivity timing issues
  let parsedUrlParts = { scheme: 'https', host: '', port: '', path: '/', query: '' }

  if (entry) {
    try {
      const url = new URL(entry.url)
      parsedUrlParts = {
        scheme: url.protocol.replace(':', ''),
        host: url.hostname,
        port: url.port || '',
        path: url.pathname || '/',
        query: url.search ? url.search.substring(1) : ''
      }
    } catch {
      // Use defaults if URL parsing fails
    }
  }

  // Set form values
  scheme.value = parsedUrlParts.scheme
  host.value = parsedUrlParts.host
  port.value = parsedUrlParts.port
  path.value = parsedUrlParts.path
  query.value = parsedUrlParts.query
  triggerRequest.value = true
  triggerResponse.value = false
}

// Watch for dialog opening
watch(() => props.open, (isOpen, wasOpen) => {
  if (isOpen && !wasOpen && props.entry) {
    // Dialog is opening with an entry
    fillFromEntry(props.entry)
  } else if (!isOpen) {
    // Dialog is closing - reset form state
    scheme.value = ''
    host.value = ''
    port.value = ''
    path.value = ''
    query.value = ''
    triggerRequest.value = true
    triggerResponse.value = false
  }
}, { immediate: false })

// Watch for entry changes (when dialog is already open)
watch(() => props.entry, (entry, prevEntry) => {
  if (props.open && entry && entry !== prevEntry) {
    // Entry changed while dialog is open
    fillFromEntry(entry)
  }
}, { immediate: false })

// Determine trigger type
const getTrigger = (): BreakpointTrigger => {
  if (triggerRequest.value && triggerResponse.value) return 'both'
  if (triggerResponse.value) return 'response'
  if (triggerRequest.value) return 'request'
  return 'request' // Default fallback
}

// Handle confirm - manually control dialog close
const handleConfirm = () => {
  if (!props.entry || !isValid.value) return
  
  const trigger = getTrigger()
  
  const breakpoint: BreakpointItem = {
    id: `bp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    scheme: scheme.value,
    host: host.value,
    port: port.value || undefined,
    path: path.value,
    query: query.value || undefined,
    trigger,
    enabled: true,
    timestamp: new Date().toISOString()
  }
  
  // Emit confirm FIRST, then close dialog
  emit('confirm', breakpoint)
  emit('update:open', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:open', false)
}

// Validation
const isValid = computed(() => {
  return host.value.trim() !== '' && (triggerRequest.value || triggerResponse.value)
})
</script>

<template>
  <AlertDialog v-model:open="openProxy">
    <AlertDialogContent class="max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>Set Breakpoint</AlertDialogTitle>
        <AlertDialogDescription>
          Configure when to intercept this request. You can edit it later before sending.
        </AlertDialogDescription>
      </AlertDialogHeader>
      
      <div class="space-y-4 py-4">
        <!-- URL Pattern fields -->
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
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
            <Label for="host" class="text-xs">Host</Label>
            <Input
              id="host"
              v-model="host"
              placeholder="api.example.com"
              class="h-8 text-sm font-mono"
            />
          </div>
          
          <div class="space-y-1.5">
            <Label for="path" class="text-xs">Path</Label>
            <Input
              id="path"
              v-model="path"
              placeholder="/api/v1/users"
              class="h-8 text-sm font-mono"
            />
          </div>
          
          <div class="space-y-1.5">
            <Label for="query" class="text-xs">Query (optional)</Label>
            <Input
              id="query"
              v-model="query"
              placeholder="page=1&limit=10"
              class="h-8 text-sm font-mono"
            />
          </div>
        </div>
        
        <!-- Trigger selection with v-model -->
        <div class="space-y-3 pt-2 border-t">
          <Label class="text-xs text-muted-foreground">Trigger Point</Label>
          <div class="flex items-center gap-6">
            <div class="flex items-center space-x-2">
              <Checkbox
                id="trigger-request"
                v-model="triggerRequest"
              />
              <Label for="trigger-request" class="text-sm font-normal cursor-pointer">
                Request
              </Label>
            </div>
            <div class="flex items-center space-x-2">
              <Checkbox
                id="trigger-response"
                v-model="triggerResponse"
              />
              <Label for="trigger-response" class="text-sm font-normal cursor-pointer">
                Response
              </Label>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            Select when to pause: before sending (Request) or after receiving (Response)
          </p>
        </div>
      </div>
      
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">Cancel</AlertDialogCancel>
        <!-- Use Button instead of AlertDialogAction to control close manually -->
        <Button
          @click="handleConfirm"
          :disabled="!isValid"
        >
          Set Breakpoint
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
