<script setup lang="ts">
  import { computed, ref, onMounted, watch, nextTick } from 'vue'
  import { ChevronLeftIcon, Star, X, Save, Edit } from 'lucide-vue-next'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import { useComponentsTab } from '@/hooks/useComponentsTab'
  import {
    TooltipProvider,
    Tooltip,
    TooltipContent,
    TooltipTrigger
  } from '@/components/ui/tooltip'
  import JsonEditor from '@/components/JsonEditor.vue'
  
  import type { TreeNodeModel } from '@/types/tree'
  import type { FavoriteItem, BaseInspectorSettings } from '@/types/inspector'
  import { useInspectorSettings } from '@/settings/useInspectorSettings'
  import { useRuntime } from '@/runtime'
  
  const runtime = useRuntime()
  
  type ValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined'
  
  
  // --- Props и Emits ---
  const props = defineProps<{ node: TreeNodeModel }>()
  defineEmits<{ back: [] }>()
  
  // --- Favorites ---
  const settings = ref<BaseInspectorSettings | null>(null)
  
  // --- JSON Mode ---
  const jsonMode = ref<'text' | 'tree'>('text')
  
  // Загружаем настройки
  useInspectorSettings().then(s => {
      settings.value = s
      jsonMode.value = s?.json?.mode ?? 'text'
  })
  
  // Проверяем, находится ли элемент в избранном
  const isFavorite = computed(() => {
    if (!settings.value?.favorites) return false
  
    const elementId = getElementIdentifier(props.node)
    return settings.value.favorites.some((fav: FavoriteItem) => fav.id === elementId)
  })
  
  // Получаем уникальный идентификатор элемента для избранного
  function getElementIdentifier(node: TreeNodeModel): string {
    // Используем componentUid как основной идентификатор, если он есть
    if (node.componentUid) {
      return node.componentUid
    }
  
    // Fallback: name + elementInfo для уникальности
    const elementInfo = getElementInfo(node)
    return `${node.name}::${elementInfo}`
  }
  
  // Получаем информацию об элементе (tag.class)
  function getElementInfo(node: TreeNodeModel): string {
    if (node.element) {
      if (node.element instanceof HTMLElement) {
        const tag = node.element.tagName.toLowerCase()
        const cls = node.element.className ? '.' + node.element.className.trim().replace(/\s+/g, '.') : ''
        return tag + cls
      } else if (node.element.tagName) {
        const tag = node.element.tagName.toLowerCase()
        const cls = node.element.className ? '.' + node.element.className.trim().replace(/\s+/g, '.') : ''
        const id = node.element.id ? `#${node.element.id}` : ''
        return tag + cls + id
      }
    }
  
    // Fallback на rootElement
    if (node.rootElement?.tagName) {
      const tag = node.rootElement.tagName.toLowerCase()
      const cls = node.rootElement.className ? '.' + node.rootElement.className.trim().replace(/\s+/g, '.') : ''
      const id = node.rootElement.id ? `#${node.rootElement.id}` : ''
      return tag + cls + id
    }
  
    return 'div'
  }
  
  // Добавление/удаление из избранного
  async function toggleFavorite() {
    if (!settings.value) return
  
    const elementId = getElementIdentifier(props.node)
  
    if (isFavorite.value) {
      // Удаляем из избранного
      settings.value.favorites = settings.value.favorites.filter((fav: FavoriteItem) => fav.id !== elementId)
    } else {
      // Добавляем в избранное
      const favoriteItem: FavoriteItem = {
        id: elementId,
        tagName: props.node.element?.tagName || props.node.rootElement?.tagName || 'div',
        className: props.node.element?.className || props.node.rootElement?.className,
        name: props.node.name,
        timestamp: new Date().toISOString()
      }
      settings.value.favorites.push(favoriteItem)
    }
  
    // Сохраняем настройки
    try {
      const settingsToSave = JSON.parse(JSON.stringify(settings.value))
      await runtime.storage.set('vue-inspector-settings', settingsToSave)
    } catch (error) {
      // Ignore save errors
    }
  }
  
  
  // --- Хук для редактирования пропсов ---
  import { ref as createRef } from 'vue'
  const {
    startEditingProps,
    saveEditedProps,
    cancelEditing: cancelPropsEditing,
    updateEditedProp,
    editingComponent
  } = useComponentsTab(createRef<TreeNodeModel[]>([]), {})
  
  const componentUid = computed(() => props.node.componentUid || '')
  const isEditingProps = ref(false)
  
  
  const startPropsEditing = () => {
    isEditingProps.value = true
    startEditingProps?.(componentUid.value)
  }
  
  const savePropsChanges = async () => {
    if (!isJsonValid.value) return
    try {
      const parsed = JSON.parse(editedJson.value)
  
      // Обновляем редактируемые пропсы через хук - передаем все пропсы сразу
      Object.entries(parsed).forEach(([key, value]) => {
        updateEditedProp?.(key, value)
      })
  
      // Сохраняем через сервис - это отправит изменения в injected script
      const saveResult = await saveEditedProps?.()
      
      if (saveResult === true) {
        
        // Обновляем JSON редактор локально
        saveJson()
        isEditingProps.value = false
        
        // Обновляем props в node для отображения
        props.node.props = { ...parsed }
        props.node.jsonProps = JSON.stringify(parsed, null, 2)
        props.node.timestamp = new Date().toISOString()
      } else {
      }
    } catch (err) {
    }
  }
  
  
  // --- UI JSON редактора ---
  const overflowMap = ref<Record<string, boolean>>({})
  function checkOverflow(key: string, el: unknown) {
    if (!(el instanceof HTMLElement)) return
    nextTick(() => {
      overflowMap.value[key] = el.scrollWidth > el.clientWidth
    })
  }
  
  
  const json = computed(() => {
    if (props.node.props) return JSON.stringify(props.node.props, null, 2)
    if (props.node.jsonProps) return props.node.jsonProps
    return '{}'
  })
  
  const editedJson = ref(json.value.trim())
  const isEditing = ref(false)
  
  const isJsonValid = computed(() => {
    try { JSON.parse(editedJson.value); return true } catch { return false }
  })
  
  const nodeName = computed(() => props.node.name || '—')
  
  // Element info (like in TreeNode.vue)
  const elementInfo = computed(() => {
    // Используем element (элемент самого компонента)
    if (props.node.element) {
      if (props.node.element instanceof HTMLElement) {
        // HTMLElement
        const tag = props.node.element.tagName.toLowerCase()
        const cls = props.node.element.className
          ? '.' + props.node.element.className.trim().replace(/\s+/g, '.')
          : ''
        return tag + cls
      } else if (props.node.element.tagName) {
        // Объект с tagName, className, id
        const tag = props.node.element.tagName.toLowerCase()
        const cls = props.node.element.className
          ? '.' + props.node.element.className.trim().replace(/\s+/g, '.')
          : ''
        return tag + cls
      }
    }
  
    // Fallback на rootElement (корневой элемент Vue приложения)
    if (props.node.rootElement?.tagName) {
      const tag = props.node.rootElement.tagName.toLowerCase()
      const cls = props.node.rootElement.className
        ? '.' + props.node.rootElement.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    }
  
    return 'div'
  })
  
  const truncatedElementInfo = computed(() => {
    const info = elementInfo.value
    return info.length > 30 ? info.substring(0, 30) + '...' : info
  })
  
  const isElementInfoTruncated = computed(() => {
    return elementInfo.value.length > 30
  })
  const formattedTime = computed(() => {
    if (!props.node.timestamp) return '—'
    const d = new Date(props.node.timestamp)
    return d.toISOString().replace('T', ' ').slice(0, 19)
  })
  
  
  // Сохранение JSON изменений
  function saveJson() {
    try {
      const parsed = JSON.parse(editedJson.value)
      editedJson.value = JSON.stringify(parsed, null, 2)
      props.node.props = parsed
      props.node.jsonProps = editedJson.value
      props.node.timestamp = new Date().toISOString()
  
      isEditing.value = false
    } catch (error) {
    }
  }
  
  function cancelEdit() {
    editedJson.value = json.value.trim()
    isEditing.value = false
  }
  
  
  // --- Actions кнопки ---
  const handleCancelClick = () => {
    if (isEditingProps.value) {
      cancelPropsEditing?.()
      isEditingProps.value = false
    } else if (isEditing.value) {
      cancelEdit()
    } else {
      // Если не редактируем, то переключаем избранное
      toggleFavorite()
    }
  }
  
  const handleSaveClick = async () => {
    
    if (isEditingProps.value) {
      await savePropsChanges()   // теперь логируются изменения
    } else if (isEditing.value) {
      // Если редактируем JSON, пытаемся сохранить через сервис пропсов
      if (!isJsonValid.value) {
        return
      }
      
      try {
        const parsed = JSON.parse(editedJson.value)
        
        // Начинаем редактирование пропсов
        startEditingProps?.(componentUid.value)
        
        // Обновляем редактируемые пропсы
        Object.entries(parsed).forEach(([key, value]) => {
          updateEditedProp?.(key, value)
        })
        
        // Сохраняем через сервис
        const saveResult = await saveEditedProps?.()
        
        if (saveResult === true) {
          saveJson()
          // Обновляем props в node для отображения
          props.node.props = { ...parsed }
          props.node.jsonProps = JSON.stringify(parsed, null, 2)
          props.node.timestamp = new Date().toISOString()
        } else {
          saveJson() // Сохраняем локально, даже если не удалось обновить в исходнике
        }
      } catch (err) {
        saveJson() // Сохраняем локально в случае ошибки
      }
    } else {
      isEditing.value = true
    }
  }
  
  </script>
  
  <template>
    <TooltipProvider>
      <ScrollArea class="h-full">
        <div class="flex flex-col gap-2 pr-2">
          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <button class="p-2 border rounded" @click="$emit('back')">
                <ChevronLeftIcon class="w-4 h-4" />
              </button>
              <h3 class="text-lg font-semibold ml-2">Props Details</h3>
            </div>
            <div class="text-sm text-muted-foreground p-2">
              Updated: {{ formattedTime }}
            </div>
          </div>
  
          <!-- Info + Actions -->
          <div class="flex justify-between items-end ml-2">
            <div class="flex flex-col gap-2">
              <div class="flex flex-col gap-1 min-w-0">
                <span class="font-semibold text-base truncate">{{ nodeName }}</span>
                <div class="flex-shrink-0">
                  <Tooltip v-if="isElementInfoTruncated">
                    <TooltipTrigger as-child>
                      <Badge class="max-w-[200px] truncate">{{ truncatedElementInfo }}</Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ elementInfo }}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Badge v-else class="max-w-[200px] truncate">{{ truncatedElementInfo }}</Badge>
                </div>
              </div>
            </div>
  
            <!-- Actions -->
            <div class="flex gap-2">
              <Button
                  variant="outline"
                  size="icon"
                  @click="handleCancelClick"
                  :title="isEditingProps ? 'Cancel props edit' : (isEditing ? 'Cancel' : (isFavorite ? 'Remove from favorites' : 'Add to favorites'))"
              >
                <component :is="isEditingProps ? X : (isEditing ? X : Star)" :class="[
                  'w-4 h-4',
                  isFavorite && !isEditingProps && !isEditing ? 'text-yellow-500 fill-yellow-500' : ''
                ]" />
              </Button>
              <Button
                  variant="outline"
                  size="icon"
                  :disabled="(isEditing && !isJsonValid) || (isEditingProps && !isJsonValid)"
                  @click="handleSaveClick"
                  :title="isEditingProps ? 'Save props' : (isEditing ? 'Save' : 'Edit')"
              >
                <component :is="isEditingProps ? Save : (isEditing ? Save : Edit)" class="w-4 h-4" />
              </Button>
            </div>
          </div>
  
          <!-- JSON редактор и Props Table -->
          <JsonEditor
            v-model="editedJson"
            :editable="isEditing"
            :show-copy="true"
            :mode="jsonMode"
            @edit="isEditing = true"
            @cancel="cancelEdit"
            @save="saveJson"
            class="mt-2"
          />
        </div>
      </ScrollArea>
    </TooltipProvider>
  </template>
  