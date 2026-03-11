<script setup lang="ts">
  import { computed, onMounted, onUnmounted } from 'vue'
  import { Infusion } from '@/components/ui/infusion'
  import { useAutoUnhighlight } from '@/composables/useAutoUnhighlight'
  import { useUpdateChecker } from '@/composables/useUpdateChecker'
  import { inspectorState, useInspectorSettings } from '@/settings/useInspectorSettings'
  import { mediaUrls } from '@/settings/mediaStore'
  import { wallpapers, defaultWallpaperUrl } from '@/assets/wallpapers'
  import Navigation from '@/features/Navigation.vue'
  import { Toaster } from '@/components/ui/Toaster'

  useAutoUnhighlight()
  useUpdateChecker()

  onMounted(() => useInspectorSettings())

  const customize = computed(() => inspectorState.customize)
  const infusionSrc = computed(() => {
    const img = customize.value?.image
    if (!img) return defaultWallpaperUrl
    if (img.sourceType === 'link' && img.url) return img.url
    if (img.sourceType === 'file' && img.savedFileId) {
      if (img.savedFileId.startsWith('wallpaper:')) {
        return wallpapers.find(w => w.id === img.savedFileId)?.url || defaultWallpaperUrl
      }
      return mediaUrls[img.savedFileId] || defaultWallpaperUrl
    }
    return defaultWallpaperUrl
  })

  function selectNodeContents(node: Node) {
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    range.selectNodeContents(node)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  function handleSelectAll(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.code !== 'KeyA') return

    const target = e.target as HTMLElement | null
    if (!target) return

    // input / textarea handle their own Ctrl+A natively (scoped to the field)
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    e.preventDefault()

    // contenteditable — select only within this element
    if (target.isContentEditable) {
      selectNodeContents(target)
      return
    }

    // pre / code (readonly JSON viewer) — select only that code block
    const pre = target.closest('pre')
    if (pre) {
      selectNodeContents(pre)
      return
    }

    // Injected iframe / DevTools — select .app-content to avoid blue frame outline
    if (document.documentElement.hasAttribute('data-injected')) {
      const content = document.querySelector('.app-content') || document.getElementById('app')
      if (content) selectNodeContents(content)
      return
    }

    // Everything else — no selection
    window.getSelection()?.removeAllRanges()
  }

  onMounted(() => document.addEventListener('keydown', handleSelectAll, true))
  onUnmounted(() => document.removeEventListener('keydown', handleSelectAll, true))
  </script>

  <template>
    <div class="relative h-screen overflow-hidden" @contextmenu.prevent>
      <Infusion
      :src="infusionSrc"
      :opacity="customize.imageOpacity"
      :opacityDark="customize.imageOpacity"
      :zIndex="100"
      :blur="customize.blur"
      :positionX="customize.positionX"
      :positionY="customize.positionY"
      :scale="customize.scale"
      blendMode="normal"
      :relative="true"
      type="image"
      />

      <div class="relative z-10 h-full">
        <div class="app-shell h-full">
          <div class="w-full h-full flex flex-col bg-background relative overflow-hidden">
            <div class="relative z-10 flex-1 min-h-0 overflow-hidden">
              <div class="app-content h-full">
                <Navigation />
              </div>
            </div>
          </div>
          <Toaster :toast-options="{ duration: 5000 }" />
        </div>
      </div>
    </div>
  </template>