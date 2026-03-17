<script setup lang="ts">
import { ref, computed } from 'vue'
import { GlobeIcon, PlusIcon, Trash2Icon, LoaderCircleIcon } from 'lucide-vue-next'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu'
import type { SavedFile } from '@/settings/inspectorSettings'
import { mediaUrls } from '@/settings/mediaStore'
import { wallpapers, defaultWallpaperId } from '@/assets/wallpapers'

const props = defineProps<{
  open: boolean
  savedFiles: SavedFile[]
  /** URLs added by user via Input */
  urlImages?: string[]
  selectedSavedFileId?: string
  selectedUrl?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'select-file': [id: string, name: string]
  'select-url': [url: string]
  'add-url': [url: string]
  'remove-url': [url: string]
  'add-file': [file: File]
  'remove-file': [id: string]
}>()

const urlInput = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const mediaFiles = computed(() =>
  props.savedFiles.filter(f =>
    f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')
  )
)

function isVideoFile(mime: string): boolean {
  return mime.startsWith('video/')
}

const urlImagesList = computed(() => props.urlImages ?? [])

function isWallpaperSelected(wpId: string): boolean {
  if (wpId === props.selectedSavedFileId) return true
  if (!props.selectedSavedFileId && !props.selectedUrl && wpId === defaultWallpaperId) return true
  return false
}

function isUrlSelected(url: string): boolean {
  return props.selectedUrl === url
}

function handleAddUrl() {
  const url = urlInput.value.trim()
  if (!url) return
  emit('add-url', url)
  urlInput.value = ''
}

function getUrlDisplayName(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname
    const name = path.split('/').filter(Boolean).pop() || u.hostname
    return decodeURIComponent(name)
  } catch (error) {
    console.error('[settings/ImagePickerDrawer] getUrlDisplayName failed:', url, error)
    return url.slice(0, 40) + (url.length > 40 ? '…' : '')
  }
}

function handleBrowseFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input?.files
  if (!files) return
  Array.from(files).forEach(file => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      emit('add-file', file)
    }
  })
  input.value = ''
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogv|mov)(\?|$)/i.test(url)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
</script>

<template>
  <Drawer
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DrawerContent class="image-picker-drawer">
      <div class="flex flex-col flex-1 min-h-0" @contextmenu.prevent>
        <DrawerHeader>
          <DrawerTitle>Background Image / Video</DrawerTitle>
        </DrawerHeader>

        <ScrollArea class="image-picker__scroll-area">
        <div class="image-picker__body">
          <!-- Custom backgrounds -->
          <div class="image-picker__section">
            <h3 class="image-picker__section-title">Custom Backgrounds</h3>

            <div class="image-picker__url-input-row">
              <GlobeIcon :size="16" class="image-picker__url-input-icon" />
              <Input
                v-model="urlInput"
                class="image-picker__url-input"
                placeholder="Paste image or video URL and press Enter"
                @keydown.enter="handleAddUrl"
              />
              <Button
                variant="secondary"
                size="sm"
                :disabled="!urlInput.trim()"
                @click="handleAddUrl"
              >
                Add
              </Button>
            </div>

            <div class="image-picker__grid">
              <button
                type="button"
                class="image-picker__drop-zone"
                @click="fileInput?.click()"
              >
                <PlusIcon :size="32" class="image-picker__drop-zone-icon" />
                <span class="image-picker__drop-zone-title">Click to browse</span>
                <span class="image-picker__drop-zone-hint">JPG, PNG, WebP, GIF, MP4, WebM</span>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  class="sr-only"
                  @change="handleBrowseFiles"
                />
              </button>

              <ContextMenu v-for="url in urlImagesList" :key="url">
                <ContextMenuTrigger as-child>
                  <div
                    class="image-picker__item"
                    :class="{ 'image-picker__item--selected': isUrlSelected(url) }"
                    @click="emit('select-url', url)"
                  >
                    <div class="image-picker__item-thumb">
                      <video
                        v-if="isVideoUrl(url)"
                        :src="url"
                        class="image-picker__item-media"
                        muted
                        loop
                        playsinline
                        preload="metadata"
                        @error="($event.target as HTMLVideoElement).style.display = 'none'"
                      />
                      <img
                        v-else
                        :src="url"
                        :alt="getUrlDisplayName(url)"
                        class="image-picker__item-media"
                        loading="lazy"
                        @error="($event.target as HTMLImageElement).style.display = 'none'"
                      />
                      <div class="image-picker__item-placeholder image-picker__item-placeholder--url-fallback">
                        <LoaderCircleIcon :size="20" class="image-picker__loader-icon" />
                      </div>
                    </div>

                    <div class="image-picker__item-overlay">
                      <div class="image-picker__item-overlay-text">
                        <span class="image-picker__item-name">{{ getUrlDisplayName(url) }}</span>
                        <span class="image-picker__item-type">{{ isVideoUrl(url) ? 'Video URL' : 'URL' }}</span>
                      </div>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent class="w-44">
                  <ContextMenuItem class="text-destructive_text" @click="emit('remove-url', url)">
                    <Trash2Icon class="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              <ContextMenu v-for="file in mediaFiles" :key="file.id">
                <ContextMenuTrigger as-child>
                  <div
                    class="image-picker__item"
                    :class="{ 'image-picker__item--selected': file.id === selectedSavedFileId }"
                    @click="emit('select-file', file.id, file.name)"
                  >
                    <div class="image-picker__item-thumb">
                      <video
                        v-if="isVideoFile(file.mimeType) && mediaUrls[file.id]"
                        :src="mediaUrls[file.id]"
                        class="image-picker__item-media"
                        muted
                        loop
                        playsinline
                        preload="metadata"
                      />
                      <img
                        v-else-if="!isVideoFile(file.mimeType) && mediaUrls[file.id]"
                        :src="mediaUrls[file.id]"
                        :alt="file.name"
                        class="image-picker__item-media"
                        loading="lazy"
                      />
                      <div v-else class="image-picker__item-placeholder">
                        <LoaderCircleIcon :size="20" class="image-picker__loader-icon" />
                      </div>
                    </div>

                    <div class="image-picker__item-overlay">
                      <div class="image-picker__item-overlay-text">
                        <span class="image-picker__item-name">{{ file.name }}</span>
                        <span class="image-picker__item-type">{{ formatFileSize(file.size) }} · {{ isVideoFile(file.mimeType) ? 'Video' : 'Image' }}</span>
                      </div>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent class="w-44">
                  <ContextMenuItem class="text-destructive_text" @click="emit('remove-file', file.id)">
                    <Trash2Icon class="h-4 w-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
          </div>

          <!-- Default backgrounds -->
          <div class="image-picker__section">
            <h3 class="image-picker__section-title">Default Backgrounds</h3>

            <div class="image-picker__grid">
              <div
                v-for="wp in wallpapers"
                :key="wp.id"
                class="image-picker__item"
                :class="{ 'image-picker__item--selected': isWallpaperSelected(wp.id) }"
                @click="emit('select-file', wp.id, wp.name)"
              >
                <div class="image-picker__item-thumb">
                  <img
                    :src="wp.url"
                    :alt="wp.name"
                    class="image-picker__item-media"
                    loading="lazy"
                  />
                </div>

                <div class="image-picker__item-overlay">
                  <div class="image-picker__item-overlay-text">
                    <span class="image-picker__item-name">{{ wp.name }}</span>
                    <span class="image-picker__item-type">Built-in</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </ScrollArea>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<style>
.image-picker-drawer {
  height: 80vh !important;
}

.image-picker__scroll-area {
  overflow: hidden;
  min-height: 0;
  flex: 1;
}

.image-picker__body {
  padding: 8px 24px 24px;
}

.image-picker__section {
  margin-bottom: 32px;
}

.image-picker__section:last-child {
  margin-bottom: 0;
}

.image-picker__section-title {
  margin: 0 0 8px;
  color: hsl(var(--foreground));
  font-size: 15px;
  font-weight: 600;
}

.image-picker__grid {
  display: grid;
  gap: 16px;
  grid-auto-rows: 1fr;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.image-picker__drop-zone {
  display: flex;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 2px dashed hsl(var(--border));
  border-radius: var(--radius-md);
  aspect-ratio: 4 / 3;
  background: hsl(var(--muted) / 30%);
  cursor: pointer;
  transition: all 0.2s ease;
}

.image-picker__drop-zone:hover {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.image-picker__drop-zone-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.image-picker__drop-zone:hover .image-picker__drop-zone-icon {
  color: hsl(var(--primary));
}

.image-picker__drop-zone-title {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 500;
}

.image-picker__drop-zone-hint {
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.image-picker__url-input-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.image-picker__url-input-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.image-picker__url-input {
  height: 2rem;
  flex: 1;
  font-size: 13px;
}

.image-picker__item {
  position: relative;
  overflow: hidden;
  min-height: 0;
  border-radius: var(--radius-md);
  aspect-ratio: 4 / 3;
  cursor: pointer;
  -webkit-mask-image: radial-gradient(white, black);
  transition: box-shadow 0.2s ease;
}

.image-picker__item:hover {
  box-shadow: 0 4px 12px hsl(0deg 0% 0% / 25%);
}

.image-picker__item--selected::before {
  position: absolute;
  z-index: 5;
  border: 2px solid hsl(var(--primary));
  border-radius: var(--radius-md);
  content: '';
  inset: 0;
  pointer-events: none;
}

.image-picker__item-thumb {
  position: absolute;
  inset: 0;
}

.image-picker__item-media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-picker__item-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: hsl(var(--muted) / 50%);
}

.image-picker__item-placeholder--url-fallback {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.image-picker__item-thumb .image-picker__item-media {
  position: relative;
  z-index: 1;
}

.image-picker__loader-icon {
  animation: image-picker-spin 1s linear infinite;
  color: hsl(var(--muted-foreground));
}

@keyframes image-picker-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.image-picker__item-overlay {
  position: absolute;
  z-index: 1;
  right: -1px;
  bottom: -1px;
  left: -1px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 12px;
  backdrop-filter: blur(8px);
  background: linear-gradient(to top, hsl(0deg 0% 0% / 70%), hsl(0deg 0% 0% / 20%));
  gap: 8px;
  transition: all 0.2s ease;
}

.image-picker__item:hover .image-picker__item-overlay {
  background: linear-gradient(to top, hsl(0deg 0% 0% / 79%), hsl(0deg 0% 0% / 25%));
}

.image-picker__item-overlay-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

.image-picker__item-name {
  display: block;
  overflow: hidden;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-picker__item-type {
  color: hsl(0deg 0% 100% / 80%);
  font-size: 11px;
}
</style>
