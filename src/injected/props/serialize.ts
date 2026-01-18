// src/injected/serialize.ts

/**
 * Сериализует props, удаляя функции и циклические ссылки.
 * @param props - Объект props для сериализации.
 * @param visited - WeakSet для отслеживания посещённых объектов (для предотвращения циклических ссылок).
 * @returns Сериализованный объект props.
 */
export function serializeProps(props: any, visited = new WeakSet()): any {
  if (props === null || props === undefined) {
    return props
  }

  if (typeof props !== 'object') {
    return props
  }

  if (visited.has(props)) {
    return Array.isArray(props) ? [] : {}
  }

  if (props instanceof HTMLElement || props instanceof Node) {
    return {}
  }

  if (typeof props === 'function') {
    return {}
  }

  visited.add(props)

  if (Array.isArray(props)) {
    const serializedArray: any[] = []
    for (let i = 0; i < props.length; i++) {
      const value = props[i]

      if (typeof value === 'function') {
        continue
      }

      if (value instanceof HTMLElement || value instanceof Node) {
        continue
      }

      if (typeof value === 'object' && value !== null) {
        if (visited.has(value)) {
          continue
        }
        try {
          JSON.stringify(value)
          serializedArray.push(serializeProps(value, visited))
        } catch (e) {
          continue
        }
      } else {
        serializedArray.push(value)
      }
    }
    return serializedArray
 }

  const serialized: Record<string, any> = {}

  try {
    for (const key in props) {
      if (!props.hasOwnProperty(key)) continue

      const value = props[key]

      if (typeof value === 'function') {
        continue
      }

      if (value instanceof HTMLElement || value instanceof Node) {
        continue
      }

      if (typeof value === 'object' && value !== null) {
        if (visited.has(value)) {
          continue
        }
        try {
          JSON.stringify(value) // Проверяем, можно ли сериализовать
          serialized[key] = serializeProps(value, visited)
        } catch (e) {
          continue
        }
      } else {
        serialized[key] = value
      }
    }
  } catch (e) {
    // Игнорируем ошибки сериализации
 }

  return serialized
}