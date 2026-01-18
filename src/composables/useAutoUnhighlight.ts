import { watch, type Ref } from 'vue'
import { hasHighlightableComponents } from './useTreeNodeTracker'
import { useRuntime } from '@/runtime'

// Функция для снятия подсветки элементов
async function unhighlightElements() {
  try {
    const runtime = useRuntime()
    
    // Отправляем сообщение в content script
    // Не ждем ответа - это fire-and-forget операция
    runtime.sendMessage({
      type: 'UNHIGHLIGHT_ELEMENT'
    }).catch(error => {
      // Игнорируем ошибки - подсветка может быть уже снята или content script не готов
    })
  } catch (error) {
  }
}

// Автоматически снимаем подсветку в следующих случаях:
// 1. Когда пользователь возвращается из details в list view (selectedNode становится null)
// 2. Когда подсвечиваемых TreeNode компонентов становится 0 (старая логика, если selectedNode не передан)
export function useAutoUnhighlight(selectedNode?: Ref<any>) {
  if (selectedNode) {
    // Новая логика: снимаем подсветку только когда возвращаемся к списку
    watch(selectedNode, (newSelectedNode, oldSelectedNode) => {
      // Пользователь вернулся из details в list view (selectedNode стал null)
      if (oldSelectedNode && !newSelectedNode) {
        unhighlightElements()
      }
    }, { immediate: false })
  } else {
    // Старая логика: снимаем подсветку только когда компонентов не стало
    watch(hasHighlightableComponents, (newHasComponents, oldHasComponents) => {
      if (oldHasComponents && !newHasComponents) {
        unhighlightElements()
      }
    }, { immediate: false })
  }
}
