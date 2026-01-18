// src/injected/dom-mapping.ts

// Define interfaces locally to avoid import issues
interface ElementInfo {
  tagName?: string
  id?: string
  className?: string
  testId?: string
}

/**
 * Находит корневой DOM-элемент компонента.
 * @param el - DOM-элемент для поиска.
 * @returns Корневой DOM-элемент компонента.
 */
export function findComponentRootEl(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null

  // 1. Если сам элемент — визуальный корень UI-компонента
  if (
    el.classList?.contains('or-select') ||
    el.hasAttribute?.('data-test-id')
  ) {
    return el
  }

  // 2. Поднимаемся вверх по DOM
  let current: HTMLElement | null = el

  while (current && current !== document.body) {
    if (
      current.classList?.contains('or-select') ||
      current.hasAttribute?.('data-test-id')
    ) {
      return current
    }
    current = current.parentElement
  }

 // 3. fallback — исходный элемент
  return el
}

/**
 * Получает информацию об элементе.
 * @param el - DOM-элемент.
 * @returns Объект с информацией об элементе.
 */
export function getElementInfo(
  el: HTMLElement | null
): ElementInfo | null {
  if (!el) return null

  return {
    tagName: el.tagName?.toLowerCase(),
    id: el.id || undefined,
    className: typeof el.className === 'string' ? el.className : undefined,
    testId: el.getAttribute?.('data-test-id') || undefined
 }
}

/**
 * Генерирует уникальный CSS селектор для DOM элемента.
 * Исключает нестабильные классы (анимации, переходы) и ограничивает глубину.
 * @param element - DOM-элемент.
 * @returns Уникальный CSS селектор.
 */
export function generateUniqueSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`
  }

  let path = []
  let current = element

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(cls =>
        /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cls) && // Только валидные CSS классы
        !cls.includes('animate-') && // Исключаем анимационные классы
        !cls.includes('transition-') && // Исключаем классы переходов
        !cls.includes('backdrop-') // Исключаем backdrop классы
      )
      if (classes.length > 0) {
        // Берем только наиболее специфичные классы (первые 3)
        selector += '.' + classes.slice(0, 3).join('.')
      }
    }

    // Добавляем индекс среди siblings для различения похожих элементов
    const siblings = Array.from(current.parentElement?.children || [])
    const similarSiblings = siblings.filter(sibling => {
      if (sibling.tagName !== current.tagName) return false

      const currentClasses = (current.className || '').split(/\s+/).filter(cls =>
        !cls.includes('animate-') && !cls.includes('transition-') && !cls.includes('backdrop-')
      )
      const siblingClasses = (sibling.className || '').split(/\s+/).filter(cls =>
        !cls.includes('animate-') && !cls.includes('transition-') && !cls.includes('backdrop-')
      )

      return currentClasses.length > 0 && siblingClasses.length > 0
        ? currentClasses.some(cls => siblingClasses.includes(cls))
        : sibling.className === current.className
    })

    if (similarSiblings.length > 1) {
      const allChildren = Array.from(current.parentElement?.children || [])
      const childIndex = allChildren.indexOf(current)
      selector += `:nth-child(${childIndex + 1})`
    }

    path.unshift(selector)
    current = current.parentElement as HTMLElement

    // Ограничиваем глубину пути, но делаем его более уникальным
    if (path.length > 4) break
  }

  return path.join(' > ')
}