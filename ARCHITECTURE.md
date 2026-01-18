# Vue Inspector — Архитектура Core + Runtime Adapter

## Обзор

Проект использует архитектуру **Core + Runtime Adapter** для поддержки разных режимов работы без дублирования кода.

```
┌─────────────────────────────────────────────────────────────┐
│                         CORE                                 │
│  (Vue Tree, Pinia State, UI компоненты, бизнес-логика)      │
│                                                              │
│  Не содержит прямых вызовов chrome.*                        │
│  Использует только RuntimeAdapter interface                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ RuntimeAdapter
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    │                    ▼
┌─────────────────┐           │         ┌─────────────────┐
│ ExtensionAdapter│           │         │StandaloneAdapter│
│                 │           │         │                 │
│ chrome.runtime  │           │         │ postMessage     │
│ chrome.tabs     │           │         │ localStorage    │
│ chrome.storage  │           │         │ window APIs     │
└─────────────────┘           │         └─────────────────┘
         │                    │                    │
         ▼                    │                    ▼
┌─────────────────┐           │         ┌─────────────────┐
│ Chrome Extension│           │         │   Bookmarklet   │
│                 │           │         │                 │
│ Полный функционал           │         │ Ограниченный    │
└─────────────────┘           │         └─────────────────┘
```

## Структура файлов

```
src/
├── runtime/                    # Runtime абстракции
│   ├── types.ts               # RuntimeAdapter interface
│   ├── context.ts             # Глобальный контекст
│   ├── index.ts               # Публичный API
│   ├── vue-plugin.ts          # Vue интеграция
│   ├── extension/
│   │   └── adapter.ts         # Chrome Extension реализация
│   └── standalone/
│       └── adapter.ts         # Standalone реализация
│
├── standalone/                 # Standalone entry point
│   └── bootstrap.ts           # Инициализация standalone
│
public/
└── standalone/                 # Статические файлы
    ├── index.html             # Страница с bookmarklet
    └── loader.js              # Загрузчик для bookmarklet
```

## RuntimeAdapter Interface

```typescript
interface RuntimeAdapter {
  // Идентификатор и возможности
  readonly id: string
  readonly capabilities: RuntimeCapabilities
  
  // Storage
  readonly storage: RuntimeStorage
  
  // Ресурсы
  getResourceURL(path: string): string
  
  // Messaging
  sendMessage<T>(message: Message, timeout?: number): Promise<T>
  onMessage(handler: MessageHandler): Unsubscribe
  
  // Lifecycle
  onReady(callback: () => void): void
  destroy(): void
}
```

## Capabilities

```typescript
interface RuntimeCapabilities {
  hasBackgroundScript: boolean    // Есть background script
  hasPopup: boolean               // Есть popup UI
  canInspectOtherTabs: boolean    // Может инспектировать другие вкладки
  hasPersistentStorage: boolean   // Постоянное хранилище
  mode: 'extension' | 'standalone'
}
```

## Использование в Core

### До (с прямыми вызовами chrome.*)

```typescript
// ❌ Прямая зависимость от chrome API
async function fetchStores() {
  const [tab] = await chrome.tabs.query({ active: true })
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'PINIA_GET_STORES'
  })
  return response.stores
}
```

### После (через RuntimeAdapter)

```typescript
// ✅ Абстракция через адаптер
import { useRuntime } from '@/runtime'

async function fetchStores() {
  const runtime = useRuntime()
  const response = await runtime.sendMessage({
    type: 'PINIA_GET_STORES'
  })
  return response.stores
}
```

### В Vue компонентах

```typescript
// С использованием composable
import { useRuntime, useCapabilities } from '@/runtime'

const runtime = useRuntime()
const capabilities = useCapabilities()

// Условный UI на основе capabilities
if (capabilities.mode === 'standalone') {
  // Показать badge "Standalone Mode"
}

// Отправка сообщения
const data = await runtime.sendMessage({ type: 'GET_DATA' })
```

## План миграции

### Фаза 1: Инфраструктура ✅
- [x] Создать `RuntimeAdapter` interface
- [x] Создать `ExtensionAdapter`
- [x] Создать `StandaloneAdapter`
- [x] Создать context и Vue plugin
- [x] Создать standalone entry point

### Фаза 2: Миграция UI компонентов ✅
1. Заменить прямые `chrome.tabs.sendMessage` на `runtime.sendMessage`
2. Заменить `chrome.runtime.onMessage` на `runtime.onMessage`
3. Заменить `chrome.storage` на `runtime.storage`

Мигрированные файлы:
- [x] `src/features/stores/usePiniaStores.ts`
- [x] `src/features/stores/StoreNavigation.vue`
- [x] `src/features/stores/StoresTab.vue`
- [x] `src/features/stores/store-details/StoreDetails.vue`
- [x] `src/features/stores/StoreListCard.vue`
- [x] `src/features/props/prop-details/TreeNode.vue`
- [x] `src/features/props/prop-details/ComponentDetails.vue`
- [x] `src/features/TabsPanel.vue`
- [x] `src/hooks/useElementInspector.js`
- [x] `src/hooks/useComponentsTab.ts`
- [x] `src/hooks/useStoreTab.ts`
- [x] `src/composables/useAutoUnhighlight.ts`
- [x] `src/composables/usePersistentState.ts`
- [x] `src/injected-ui/main.ts` (инициализация runtime)

### Фаза 3: Тестирование
- [ ] Проверить работу в extension режиме
- [ ] Проверить работу в standalone режиме
- [ ] Проверить что capabilities правильно ограничивают функционал

## Использование Standalone режима

### Для администратора (деплой)

```bash
# 1. Собрать проект
npm run build

# 2. Разместить dist/ на HTTP сервере с CORS
npm run serve:standalone
# или
npx serve dist -p 5174 --cors
```

### Для пользователя (без DevTools)

1. Открыть `http://server:5174/standalone/index.html`
2. Перетащить кнопку "Vue Inspector" в закладки
3. На целевой странице — кликнуть по закладке
4. Inspector появится внизу страницы

## Ограничения Standalone режима

| Функция | Extension | Standalone |
|---------|-----------|------------|
| Инспекция Vue компонентов | ✅ | ✅ |
| Инспекция Pinia stores | ✅ | ✅ |
| Подсветка элементов | ✅ | ✅ |
| Редактирование props | ✅ | ✅ |
| Инспекция других вкладок | ✅ | ❌ |
| Popup UI | ✅ | ❌ |
| Синхронизация настроек | ✅ | Локально |

## Принципы

1. **Один Core** — вся логика инспекции в одном месте
2. **Нет if (standalone)** — различия только в адаптере
3. **Честные ограничения** — capabilities явно показывают что доступно
4. **Простота** — добавление нового режима = новый адаптер
