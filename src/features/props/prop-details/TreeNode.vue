<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import type { TreeNodeModel } from '@/types/tree'
import type { FavoriteItem } from '@/settings/inspectorSettings'
import type { BaseInspectorSettings } from '@/types/inspector'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { registerHighlightableComponent, unregisterHighlightableComponent } from '@/composables/useTreeNodeTracker'
import { useRuntime } from '@/runtime'

const runtime = useRuntime()

const props = defineProps<{ node: TreeNodeModel, depth?: number }>()
const emit = defineEmits<{ select: [node: TreeNodeModel] }>()

// 🔹 true только если есть пропсы
const hasProps = computed(() => !!props.node.props && Object.keys(props.node.props).length > 0)

// --- Favorites ---
const settings = ref<BaseInspectorSettings | null>(null)

// Загружаем настройки
useInspectorSettings().then(s => {
    settings.value = s
})

// Получаем уникальный идентификатор элемента для избранного
function getElementIdentifier(node: TreeNodeModel): string {
  // Используем componentUid как основной идентификатор, если он есть
  if (node.componentUid) {
    return node.componentUid
  }

  // Fallback: name + elementInfo для уникальности
  return `${node.name}::${elementInfo.value}`
}

// Проверяем, находится ли элемент в избранном
const isFavorite = computed(() => {
  if (!settings.value?.favorites) return false

  const elementId = getElementIdentifier(props.node)
  return settings.value.favorites.some((fav: FavoriteItem) => fav.id === elementId)
})

const handleClick = () => {
  if (!hasProps.value) return
  emit('select', props.node)
}

// Определяем, есть ли реальный DOM элемент у компонента
const hasRealDomElement = computed(() => {
  // Есть прямой элемент компонента с tagName
  if (props.node.element) {
    if (props.node.element instanceof HTMLElement) {
      return true
    }
    if (props.node.element.tagName) {
      return true
    }
  }

  // Если есть componentUid и props, но нет собственного элемента - логический компонент
  if (props.node.componentUid && props.node.props && Object.keys(props.node.props).length > 0) {
    return false
  }

  // Корневые компоненты обычно имеют DOM элементы
  if (props.node.rootElement?.tagName) {
    return true
  }

  return false
})

const elementInfo = computed(() => {
  // Используем element (элемент самого компонента), как в script_console.ini
  if (props.node.element) {
    if (props.node.element instanceof HTMLElement) {
      // HTMLElement
      const tag = props.node.element.tagName.toLowerCase()
      const cls = props.node.element.className
        ? '.' + props.node.element.className.trim().replace(/\s+/g, '.')
        : ''

      // Если это просто div без классов и id - логический компонент
      if (tag === 'div' && !cls && !props.node.element.id) {
        return 'Logic only'
      }

      return tag + cls
    } else if (props.node.element.tagName) {
      // Объект с tagName, className, id
      const tag = props.node.element.tagName.toLowerCase()
      const cls = props.node.element.className
        ? '.' + props.node.element.className.trim().replace(/\s+/g, '.')
        : ''
      const id = props.node.element.id ? `#${props.node.element.id}` : ''

      // Если это просто div без классов и id - логический компонент
      if (tag === 'div' && !cls && !props.node.element.id) {
        return 'Logic only'
      }

      return tag + cls + id
    }
  }

  // Если нет собственного DOM элемента компонента - это логический компонент
  if (!props.node.element) {
    return 'Logic only'
  }

  // Fallback на rootElement только если нет props (обычно это корневые компоненты)
  if (props.node.rootElement?.tagName) {
    const tag = props.node.rootElement.tagName.toLowerCase()
    const cls = props.node.rootElement.className
      ? '.' + props.node.rootElement.className.trim().replace(/\s+/g, '.')
      : ''
    const id = props.node.rootElement.id ? `#${props.node.rootElement.id}` : ''
    return tag + cls + id
  }

  // Если нет реального DOM элемента, показываем "Logic only"
  return 'Logic only'
})

const truncatedElementInfo = computed(() => {
  const info = elementInfo.value
  return info.length > 30 ? info.substring(0, 30) + '...' : info
})

const isElementInfoTruncated = computed(() => {
  return elementInfo.value.length > 30
})

// Стиль для badge с информацией об элементе
const elementBadgeVariant = computed(() => {
  return elementInfo.value === 'Logic only' ? 'destructive' : 'default'
})

// Определяем, может ли этот компонент быть подсвечен (то же условие, что и в highlightElement)
const canBeHighlighted = computed(() => {
  return !!(props.node.componentUid && hasRealDomElement.value && elementInfo.value !== 'Logic only')
})

// Регистрируем/разрегистрируем компонент для отслеживания подсвечиваемых элементов
watch(canBeHighlighted, (newCanBeHighlighted, oldCanBeHighlighted) => {
  if (newCanBeHighlighted && !oldCanBeHighlighted && props.node.componentUid) {
    // Компонент стал подсвечиваемым - регистрируем
    registerHighlightableComponent(props.node.componentUid)
  } else if (!newCanBeHighlighted && oldCanBeHighlighted && props.node.componentUid) {
    // Компонент перестал быть подсвечиваемым - разрегистрируем
    unregisterHighlightableComponent(props.node.componentUid)
  }
}, { immediate: true })

// При размонтировании компонента - разрегистрируем, если был зарегистрирован
onUnmounted(() => {
  if (props.node.componentUid) {
    unregisterHighlightableComponent(props.node.componentUid)
  }
})

// Функции для подсветки элементов на странице
async function highlightElement() {
  // Не подсвечиваем логические компоненты без DOM элементов
  if (!props.node.componentUid || !hasRealDomElement.value || elementInfo.value === 'Logic only') return

  try {
    await runtime.sendMessage({
      type: 'HIGHLIGHT_ELEMENT',
      componentPath: props.node.componentUid
    })
  } catch (error) {
    // Ignore highlight errors
  }
}

async function unhighlightElement() {
  try {
    await runtime.sendMessage({
      type: 'UNHIGHLIGHT_ELEMENT'
    })
  } catch (error) {
    // Ignore unhighlight errors
  }
}
</script>

<template>
  <TooltipProvider>
    <div class="tree-node w-full">
             <div
                 @click="handleClick"
                 @mouseenter="highlightElement"
                 @mouseleave="unhighlightElement"
                 :aria-disabled="!hasProps"
                 :class="[
                   'flex items-center gap-2 p-2 rounded border transition-colors duration-150',
                   hasProps
                     ? (hasRealDomElement
                         ? 'cursor-pointer hover:bg-accent'
                         : 'cursor-not-allowed opacity-60 dark:opacity-50 bg-muted/20')
                     : 'cursor-default opacity-50 dark:opacity-40 bg-background/5',
                   isFavorite ? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-600' : ''
                 ]"
             >
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">{{ node.name }}</div>
          <div class="flex gap-1 mt-1">
            <Tooltip v-if="isElementInfoTruncated">
              <TooltipTrigger as-child>
                <Badge :variant="elementBadgeVariant">{{ truncatedElementInfo }}</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ elementInfo }}</p>
              </TooltipContent>
            </Tooltip>
            <Badge v-else :variant="elementBadgeVariant">{{ truncatedElementInfo }}</Badge>
          </div>
        </div>

        <Badge
            v-if="hasProps"
            variant="secondary"
            class="text-xs rounded-full px-2 py-0.5 whitespace-nowrap"
        >
          {{ Object.keys(node.props ?? {}).length }} props
        </Badge>
      </div>
    </div>
  </TooltipProvider>
</template>
