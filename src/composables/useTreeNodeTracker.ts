import { ref, computed } from 'vue'

// Множество componentUid компонентов, которые могут быть подсвечены
const highlightableComponents = ref<Set<string>>(new Set())

// Функции для регистрации/разрегистрации подсвечиваемых TreeNode
export function registerHighlightableComponent(componentUid: string) {
  if (componentUid) {
    highlightableComponents.value.add(componentUid)
  }
}

export function unregisterHighlightableComponent(componentUid: string) {
  if (componentUid) {
    highlightableComponents.value.delete(componentUid)
  }
}

// Computed свойство для отслеживания наличия подсвечиваемых компонентов
export const hasHighlightableComponents = computed(() => highlightableComponents.value.size > 0)

// Функция для получения текущего количества подсвечиваемых компонентов
export function getHighlightableComponentCount() {
  return highlightableComponents.value.size
}

// Функция для получения списка подсвечиваемых компонентов
export function getHighlightableComponents() {
  return Array.from(highlightableComponents.value)
}
