/**
 * Модуль для распаковки Vue реактивности (refs, reactive objects)
 */

/**
 * Проверяет, является ли значение Vue ref
 */
export function isVueRef(value: any): boolean {
  return !!(value && typeof value === 'object' && value.__v_isRef === true)
}

/**
 * Проверяет, является ли значение computed ref (геттером)
 */
export function isComputedRef(value: any): boolean {
  if (!value || typeof value !== 'object') return false
  
  // Vue 3 ComputedRef has __v_isRef + effect (ReactiveEffect object)
  if (value.__v_isRef === true && value.effect !== undefined) {
    return true
  }
  
  // Alternative: check for _getter (internal computed property)
  if (value.__v_isRef === true && typeof value._getter === 'function') {
    return true
  }
  
  // Check for __v_isReadonly (computed are readonly by default)
  if (value.__v_isRef === true && value.__v_isReadonly === true) {
    return true
  }
  
  return false
}

/**
 * Проверяет, является ли значение Vue реактивным (не ref)
 */
export function isVueReactive(value: any): boolean {
  return !!(
    value &&
    typeof value === 'object' &&
    '__v_raw' in value &&
    !isVueRef(value)
  )
}

/**
 * Распаковывает Vue ref
 */
export function unwrapRef(value: any): any {
  if (isVueRef(value)) {
    return unwrapValue(value.value)
  }
  return value
}

/**
 * Распаковывает Vue reactive объект
 */
export function unwrapReactive(value: any): any {
  if (isVueReactive(value)) {
    return unwrapValue(value.__v_raw)
  }
  return value
}

/**
 * Преобразует реактивное значение в обычный объект
 */
export function toPlainObject(value: any): any {
  if (value === null || value === undefined) return value
  
  // Обработка примитивов
  if (typeof value !== 'object') return value
  
  // Попытка сериализации и десериализации для получения обычного объекта
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    // Если сериализация не работает, возвращаем как есть
    return value
  }
}

/**
 * Распаковывает значение Vue реактивности рекурсивно
 */
export function unwrapValue(value: any): any {
  if (value === null || value === undefined) return value
  
  // Обработка примитивов
  if (typeof value !== 'object') return value
  
  // Проверяем на Vue ref
  if (isVueRef(value)) {
    return unwrapValue(value.value)
  }
  
  // Проверяем на Vue reactive
  if (isVueReactive(value)) {
    return unwrapValue(value.__v_raw)
  }
  
  // Обработка массивов
  if (Array.isArray(value)) {
    return value.map(item => unwrapValue(item))
  }
  
  // Обработка объектов
  if (typeof value === 'object' && value !== null) {
    // Try to serialize and parse to get plain object (as in old version)
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      // If serialization fails, process manually
      const result: any = {}
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = unwrapValue(value[key])
        }
      }
      return result
    }
  }

  return value
}