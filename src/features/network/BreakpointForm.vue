<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ArrowLeft, Check, CirclePause } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type { NetworkEntry } from '@/types/network'
import type { BreakpointItem } from '@/types/inspector'
import { parseUrl, buildUrlPreview, getStatusClass, generateId } from './utils'

const props = defineProps<{
  entry: NetworkEntry
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'confirm', breakpoint: BreakpointItem): void
}>()

// Active section
type SectionId = 'matching'
const activeSection = ref<SectionId>('matching')

// URL Matching fields
const scheme = ref('')
const host = ref('')
const port = ref('')
const path = ref('')
const query = ref('')

// Function to fill form from entry
function fillFromEntry(entry: NetworkEntry) {
  const parsed = parseUrl(entry.url)
  scheme.value = parsed.scheme
  host.value = parsed.host
  port.value = parsed.port
  path.value = parsed.path
  query.value = parsed.query
}

// Watch for entry changes
watch(() => props.entry, (entry) => {
  if (entry) {
    fillFromEntry(entry)
  }
}, { immediate: true })

// Handle confirm
function handleConfirm() {
  if (!props.entry || !isValid.value) return
  
  const breakpoint: BreakpointItem = {
    id: generateId('bp'),
    scheme: scheme.value,
    host: host.value,
    port: port.value || undefined,
    path: path.value,
    query: query.value || undefined,
    trigger: 'request',
    enabled: true,
    timestamp: new Date().toISOString()
  }
  
  emit('confirm', breakpoint)
}

// Validation
const isValid = computed(() => {
  return host.value.trim() !== ''
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
  { id: 'matching', label: 'URL Matching' }
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
            <Badge variant="outline" class="text-amber-500 border-amber-500/50 gap-1">
              <CirclePause class="h-3 w-3" />
              Set Breakpoint
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
        
        <!-- Create Breakpoint button -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="default"
              size="sm"
              class="h-8 shrink-0 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600"
              :disabled="!isValid"
              @click="handleConfirm"
            >
              <Check class="h-3.5 w-3.5" />
              Set Breakpoint
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Create breakpoint to intercept matching requests
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
            <!-- Description -->
            <div class="p-3 bg-muted/50 rounded-md">
              <p class="text-sm text-muted-foreground">
                Configure URL pattern to intercept requests before they are sent. 
                When a matching request is made, it will pause and allow you to modify headers, params, and body.
              </p>
            </div>
            
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
            
            <!-- Trigger info (Request only) -->
            <div class="p-3 border rounded-md border-amber-500/30 bg-amber-500/5">
              <div class="flex items-center gap-2">
                <CirclePause class="h-4 w-4 text-amber-500" />
                <span class="text-sm font-medium">Request Breakpoint</span>
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                Pauses before sending request. You can modify URL params, headers, and request body.
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  </TooltipProvider>
</template>
