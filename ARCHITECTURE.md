# Vue Inspector — Architecture Overview

## Architectural Goals

Vue Inspector — это инструмент для инспекции Vue.js приложений и Pinia state management в браузере. Проект решает специфические проблемы корпоративных сред и ограничений браузерных расширений.

### Problems Solved

1. **Corporate Device Restrictions**: Многие корпоративные устройства блокируют установку браузерных расширений, делая невозможным использование DevTools extensions.

2. **Popup Limitations**: Chrome extensions не могут инспектировать другие вкладки из popup UI без сложных обходных путей через background scripts.

3. **Memory Leaks**: Долгоживущие content scripts и listeners в extensions могут приводить к утечкам памяти при навигации между страницами.

4. **Code Duplication**: Поддержка разных runtime сред (extension vs standalone) требует либо дублирования кода, либо абстракций.

5. **Platform Lock-in**: Зависимость от конкретных браузерных APIs усложняет поддержку новых платформ и сред выполнения.

### Architecture Choice Rationale

Выбрана **Core + Runtime Adapter** архитектура по следующим причинам:

- **Single Source of Truth**: Вся бизнес-логика инспекции (Core) пишется один раз и работает одинаково во всех runtime.
- **Runtime Independence**: Core не знает о chrome.* APIs — только об абстрактном RuntimeAdapter интерфейсе.
- **Capability-Driven**: Различия между runtime выражаются через capabilities, а не через условную логику.
- **Extensibility**: Добавление нового runtime = новый adapter, без изменений в Core.
- **Testability**: Core можно тестировать без браузерных зависимостей.

### Why Not Alternatives?

**Monolithic Extension**: Не решает проблему корпоративных устройств и требует сложной логики для разных UI режимов.

**Conditional Compilation**: Приводит к `#ifdef STANDALONE` везде по коду, усложняет поддержку и тестирование.

**Runtime Detection**: Поздняя детекция runtime приводит к условной логике и багам, когда один код работает по-разному в разных runtime.

**Framework-Based**: Vue Inspector должен работать в любых Vue приложениях, включая legacy, поэтому не может зависеть от конкретного фреймворка.

## High-Level Architecture Overview

Архитектура Vue Inspector построена на принципе **разделения ответственности** между бизнес-логикой и средой выполнения.

```
┌─────────────────────────────────────────────────────────────────┐
│                           CORE LAYER                             │
│                                                                 │
│  • Vue Component Tree Inspection                                │
│  • Pinia State Management Inspection                            │
│  • Props Editing & Component Details                            │
│  • UI Components & Navigation                                   │
│  • Business Logic & Data Processing                             │
│                                                                 │
│  NO direct platform API calls (chrome.*, window.*, etc.)       │
│  ONLY through RuntimeAdapter interface                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ RuntimeAdapter Contract
                              │ (Messaging, Storage, Capabilities)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RUNTIME ABSTRACTION LAYER                     │
│                                                                 │
│  • RuntimeAdapter Interface                                     │
│  • RuntimeCapabilities                                          │
│  • RuntimeStorage                                               │
│  • Message Passing Abstraction                                  │
│  • Lifecycle Management                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Platform-specific Implementation
                              ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ExtensionAdapter │     │StandaloneAdapter│     │ FutureAdapter   │
│                 │     │                 │     │                 │
│ Chrome APIs     │     │ postMessage     │     │ Platform APIs   │
│ chrome.runtime  │     │ localStorage    │     │ ...             │
│ chrome.tabs     │     │ window APIs     │     │                 │
│ chrome.storage  │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│Chrome Extension │     │  Bookmarklet    │     │ Future Runtime  │
│Full Capabilities│     │Limited Features │     │Platform Specific│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Layer Responsibilities

**Core Layer**: Чистая бизнес-логика инспекции Vue приложений. Знает только о Vue/Pinia домене и RuntimeAdapter контракте.

**Runtime Abstraction Layer**: Определяет интерфейсы и контракты между Core и платформой. Управляет lifecycle, messaging и capabilities.

**Runtime Adapters**: Конкретные реализации для разных сред выполнения. Инкапсулируют все платформенные зависимости.

### Data Flow

1. **User Interaction** → Core UI Components
2. **Business Logic** → RuntimeAdapter.sendMessage()
3. **Message Routing** → Content Script / Injected Script
4. **Vue Inspection** → Injected Modules (props, pinia)
5. **Response** → RuntimeAdapter → Core → UI Update

## Core Layer

Core содержит всю бизнес-логику инспекции Vue приложений без зависимостей от платформы. Это самая большая и сложная часть системы.

### Core Components

#### Vue Component Inspection (`src/injected/props/`)
- **Component Tree Building**: Анализ Vue component hierarchy через DevTools hook или direct DOM traversal
- **Props Inspection**: Чтение и редактирование component props в реальном времени
- **Component Details**: Метаданные компонентов, lifecycle hooks, computed properties
- **Tree Navigation**: Поиск, фильтрация и навигация по component tree

#### Pinia State Management (`src/injected/pinia/`)
- **Store Detection**: Автоматическое обнаружение Pinia stores в приложении
- **State Reading**: Доступ к state, getters, actions всех stores
- **State Modification**: Редактирование state через actions и direct mutations
- **Store Metadata**: Информация о store структуре и зависимостях

#### UI Components (`src/features/`)
- **Navigation**: Табы для переключения между Components и Stores
- **Component Tree View**: Визуализация иерархии компонентов
- **Store List**: Список доступных Pinia stores с preview
- **Property Editors**: JSON-based редакторы для props и state
- **Search & Filter**: Поиск компонентов и фильтрация по типам

#### Business Logic (`src/hooks/`, `src/composables/`)
- **useComponentsTab**: Управление состоянием component inspection
- **useStoreTab**: Управление состоянием store inspection
- **usePersistentState**: Сохранение пользовательских настроек
- **useAutoUnhighlight**: Автоматическое снятие выделения элементов

### Core Principles

1. **Platform Agnostic**: Никаких прямых вызовов chrome.*, window.*, localStorage
2. **Capability Aware**: Использование `useCapabilities()` для условной логики
3. **Reactive**: Vue Composition API для реактивного состояния
4. **Modular**: Каждый feature в отдельной папке с четкими интерфейсами
5. **Testable**: Core частично тестируем без браузерных APIs; UI logic и runtime integration требуют environment-level testing

### File Structure

```
src/
├── features/                   # UI Features
│   ├── Navigation.vue         # Main navigation tabs
│   ├── TabsPanel.vue          # Tab container
│   ├── props/                 # Component inspection UI
│   └── stores/                # Pinia stores UI
│
├── injected/                   # Inspection logic (runs in target page)
│   ├── detector.ts            # Vue/Pinia detection
│   ├── main.ts                # Entry point for injected scripts
│   ├── props/                 # Component inspection logic
│   └── pinia/                 # Pinia inspection logic
│
├── hooks/                      # Vue composables for features
│   ├── useComponentsTab.ts
│   ├── useStoreTab.ts
│   └── useTreeData.ts
│
├── composables/                # Shared composables
│   ├── useAutoUnhighlight.ts
│   ├── usePersistentState.ts
│   └── useTreeNodeTracker.ts
│
├── services/                   # Business logic services
│   ├── dataServiceFactory.ts
│   └── propsEditorService.ts
│
├── types/                      # TypeScript definitions
│   ├── inspector.ts
│   ├── store.ts
│   └── tree.ts
│
└── utils/                      # Pure utility functions
    ├── extensionBridge.ts
    └── stableUpdate.ts
```

## Runtime Abstraction Layer

Runtime Abstraction Layer определяет контракты между Core и платформой. Это тонкий слой интерфейсов, который обеспечивает:

- **Messaging**: Асинхронная коммуникация между UI и inspection logic
- **Storage**: Абстракция над persistent storage
- **Capabilities**: Декларативное описание возможностей runtime
- **Lifecycle**: Управление инициализацией и очисткой ресурсов
- **Resource Loading**: Абстракция над загрузкой статических ресурсов

### Core Interfaces

#### RuntimeAdapter Interface

```typescript
interface RuntimeAdapter {
  // Identity & Capabilities
  readonly id: string
  readonly capabilities: RuntimeCapabilities

  // Storage abstraction
  readonly storage: RuntimeStorage

  // Resource management
  getResourceURL(path: string): string

  // Message passing
  sendMessage<T = unknown>(message: Message, timeout?: number): Promise<T>
  onMessage(handler: MessageHandler): Unsubscribe

  // Lifecycle hooks
  onReady(callback: () => void): void
  destroy(): void
}
```

#### RuntimeCapabilities Interface

```typescript
interface RuntimeCapabilities {
  // Background processing
  hasBackgroundScript: boolean

  // UI capabilities
  hasPopup: boolean

  // Cross-tab inspection
  canInspectOtherTabs: boolean

  // Data persistence
  hasPersistentStorage: boolean

  // Runtime mode identifier
  mode: 'extension' | 'standalone'
}
```

#### RuntimeStorage Interface

```typescript
interface RuntimeStorage {
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}
```

#### Message Passing

```typescript
interface Message {
  type: string
  [key: string]: unknown
}

type MessageHandler = (
  message: Message,
  respond: (response: unknown) => void
) => void | boolean

type Unsubscribe = () => void
```

### Design Rationale

**Почему именно эти интерфейсы?**

1. **Messaging First**: Инспекция Vue приложений требует асинхронной коммуникации между UI и целевой страницей. Message passing — это универсальный примитив.

2. **Capabilities over Conditionals**: Вместо `if (standalone)` в Core коде — декларативное описание возможностей. Core адаптируется через capabilities.

3. **Storage Abstraction**: Разные runtime имеют разные storage механизмы (chrome.storage vs localStorage), но интерфейс одинаковый.

4. **Resource URLs**: Standalone режиму нужны absolute URLs для загрузки ресурсов, extension использует chrome.runtime.getURL().

5. **Lifecycle Management**: Явная инициализация и очистка критически важны для предотвращения memory leaks.

### Integration with Vue

Runtime интегрируется в Vue приложение через plugin:

```typescript
// src/runtime/vue-plugin.ts
export const RuntimePlugin = {
  install(app: App) {
    const runtime = useRuntime()
    app.provide(RuntimeKey, runtime)
    app.provide(CapabilitiesKey, runtime.capabilities)
  }
}
```

Core компоненты используют composables:

```typescript
// В любом Vue компоненте
import { useRuntime, useCapabilities } from '@/runtime'

const runtime = useRuntime()
const capabilities = useCapabilities()

// Отправка сообщения
const data = await runtime.sendMessage({ type: 'GET_DATA' })

// Условный UI
if (!capabilities.canInspectOtherTabs) {
  // Показать ограничение
}
```

## Runtime Adapters

Runtime Adapters — это конкретные реализации RuntimeAdapter для разных платформ. Каждый адаптер инкапсулирует все платформенные зависимости.

### ExtensionAdapter

Реализует RuntimeAdapter для Chrome Extension среды.

**Capabilities:**
```typescript
{
  hasBackgroundScript: true,     // Background script как privileged coordination layer
  hasPopup: true,               // Может открывать popup UI
  canInspectOtherTabs: true,    // Может инспектировать другие вкладки
  hasPersistentStorage: true,   // chrome.storage для персистентности
  mode: 'extension'
}
```

**Key Implementation Details:**

1. **Dual Communication Paths:**
   - **Popup/DevTools → Content Script**: Использует `chrome.tabs.sendMessage()`
   - **Injected UI (iframe) → Content Script**: Использует `window.postMessage()` с parent window

2. **Message Routing:**
   ```typescript
   // В popup/devtools: chrome.tabs.sendMessage()
   // В iframe UI: window.parent.postMessage() с специальным префиксом
   ```

3. **Storage:** `chrome.storage.local` с fallback на memory storage

4. **Resource URLs:** `chrome.runtime.getURL(path)`

### StandaloneAdapter

Реализует RuntimeAdapter для standalone режима без extension.

**Capabilities:**
```typescript
{
  hasBackgroundScript: false,    // Нет background script
  hasPopup: false,              // Нет popup UI
  canInspectOtherTabs: false,   // Может инспектировать только текущую вкладку
  hasPersistentStorage: true,   // localStorage для персистентности
  mode: 'standalone'
}
```

**Key Implementation Details:**

1. **Communication via postMessage:**
   - UI iframe ↔ Content script на main window
   - Использует prefixed messages для избежания конфликтов

2. **Storage:** localStorage с namespaced keys для изоляции

3. **Resource URLs:** Absolute URLs через baseURL конфиг

4. **Configuration:**
   ```typescript
   interface StandaloneAdapterConfig {
     baseURL: string          // Для загрузки ресурсов
     targetWindow?: Window    // Целевое окно для postMessage
     targetOrigin?: string    // Origin для postMessage security
   }
   ```

### Adapter Instantiation

```typescript
// Extension mode
import { createExtensionAdapter } from '@/runtime/extension'
const adapter = createExtensionAdapter()

// Standalone mode
import { createStandaloneAdapter } from '@/runtime/standalone'
const adapter = createStandaloneAdapter({
  baseURL: 'http://localhost:5174',
  targetWindow: window.parent
})
```

### Common Patterns

**Message Handling:**
```typescript
// Request-Response pattern
const response = await runtime.sendMessage({
  type: 'GET_COMPONENT_TREE'
})

// Broadcast pattern (для обновлений)
runtime.onMessage((message) => {
  if (message.type === 'COMPONENT_UPDATED') {
    // Обновить UI
  }
})
```

**Resource Loading:**
```typescript
// В Core коде
const scriptUrl = runtime.getResourceURL('js/content.js')

// Extension: chrome-extension://id/js/content.js
// Standalone: http://server:port/js/content.js
```

**Storage Usage:**
```typescript
// В Core коде
await runtime.storage.set('user-preferences', { theme: 'dark' })
const prefs = await runtime.storage.get('user-preferences')
```

## Lifecycle & Initialization

Правильная инициализация и очистка ресурсов критически важны для стабильности Vue Inspector, особенно в условиях долгоживущих content scripts.

### Extension Mode Lifecycle

#### 1. Background Script (`src/background.ts`)
```typescript
// Загружается при установке extension
// Слушает extension events (install, update, etc.)
chrome.runtime.onInstalled.addListener(() => {
  // Инициализация background state
})
```

#### 2. Content Script Injection
- Content script инжектируется автоматически через manifest.json
- Выполняет детекцию Vue и инициализирует injected modules

#### 3. Popup/DevTools Initialization (`src/main.ts` / `src/popup/popup.ts`)
```typescript
// Создание Vue приложения
const app = createApp(App)

// Инициализация runtime
const adapter = createExtensionAdapter()
setRuntimeAdapter(adapter)

// Регистрация runtime plugin
app.use(RuntimePlugin)

// Монтирование приложения
app.mount('#app')
```

#### 4. Injected UI Initialization (`src/injected-ui/main.ts`)
- Определяет режим работы по URL hash или window properties
- Создает соответствующий adapter
- Монтирует Vue приложение в iframe

### Standalone Mode Lifecycle

#### 1. Bookmarklet Execution
```javascript
// Глобальная функция доступна через window.VueInspector
window.VueInspector = {
  bootstrap: bootstrapStandalone
}
```

#### 2. Bootstrap Process (`src/standalone/bootstrap.ts`)
```typescript
export function bootstrapStandalone(config: StandaloneBootstrapConfig) {
  // Защита от повторной инициализации
  if (window.__VUE_INSPECTOR_INITIALIZED__) return

  // Создание и установка adapter
  const adapter = createStandaloneAdapter(config)
  setRuntimeAdapter(adapter)

  // Автоматическая инъекция UI
  if (config.autoInjectUI) {
    adapter.onReady(() => {
      injectInspectorUI(config.baseURL)
    })
  }
}
```

#### 3. Content Script Loading
```typescript
function injectInspectorUI(baseURL: string) {
  // Загрузка content script для детекции и инспекции
  const script = document.createElement('script')
  script.src = `${baseURL}/js/content.js`
  document.head.appendChild(script)
}
```

#### 4. Injected Modules Initialization (`src/injected/main.ts`)
```typescript
// Детекция Vue/Pinia при загрузке страницы
const detectionResult = detect()

// Автоматическая загрузка модулей
if (detectionResult.hasVue) {
  initPropsModule()  // Component inspection
}
if (detectionResult.hasPinia) {
  initPiniaModule()  // Store inspection
}
```

### Resource Cleanup

**Memory Leak Prevention:**

1. **Message Listeners:**
   ```typescript
   // Cleanup в adapters
   destroy(): void {
     this.removeWindowListener()
     this.removeChromeListener()
     this.pendingRequests.clear()
     this.messageListeners.clear()
   }
   ```

2. **Vue Components:**
   ```typescript
   // В composables
   onUnmounted(() => {
     runtime.onMessage(handler)() // Unsubscribe
   })
   ```

3. **Injected Scripts:**
   - Content scripts автоматически очищаются при навигации
   - Standalone режим полагается на page reload для cleanup

### Initialization Sequence

```
Extension Mode:
1. Extension loads → Background script ready
2. User opens popup/devtools → createExtensionAdapter()
3. Content script detects Vue → loads injected modules
4. UI initializes → runtime.sendMessage() works

Standalone Mode:
1. User runs bookmarklet → bootstrapStandalone()
2. Adapter created → injectInspectorUI()
3. Content script loads → detects Vue/Pinia
4. Injected modules init → UI becomes functional
```

### Error Handling

**Adapter Initialization Failures:**
- Graceful degradation в storage operations
- Timeout handling для message passing
- Fallback UI для ограниченных capabilities

**Runtime Detection Issues:**
- Standalone режим определяет runtime по URL hash/window properties
- Extension режим полагается на manifest injection

## Standalone Mode Architecture

Standalone режим — это first-class runtime, а не упрощенная версия extension. Он решает проблему корпоративных устройств, где установка расширений невозможна.

### Architecture Overview

```
Browser Tab (Target Application)
├── Main Window (Vue App)
│   ├── Content Script (Injected)
│   │   ├── Vue/Pinia Detection
│   │   └── Inspection Modules
│   └── Standalone UI (Iframe)
│       └── Vue Inspector Core
└── Bookmarklet Script (Global)
    └── Bootstrap Function
```

### Key Components

#### Bootstrap System (`src/standalone/bootstrap.ts`)
- **Global API**: `window.VueInspector.bootstrap(config)`
- **Runtime Initialization**: Создает StandaloneAdapter и устанавливает его как текущий
- **UI Injection**: Автоматически инжектирует inspector UI на страницу
- **Configuration**: Base URL для загрузки ресурсов, target window для messaging

#### Content Script Loading
```typescript
function injectInspectorUI(baseURL: string): void {
  const script = document.createElement('script')
  script.src = `${baseURL}/js/content.js`
  document.head.appendChild(script)
}
```

#### Communication Architecture
- **Iframe UI ↔ Content Script**: postMessage через parent window
- **Message Prefixing**: `__VUE_INSPECTOR__` для избежания конфликтов
- **Request-Response Pattern**: С поддержкой timeout и error handling
- **Broadcast Messages**: Для reactive updates из inspection modules

### Capabilities & Limitations

#### Available Features
- ✅ **Vue Component Inspection**: Полный анализ component tree
- ✅ **Pinia Store Inspection**: Чтение и редактирование state
- ✅ **Props Editing**: Live редактирование component props
- ✅ **Element Highlighting**: Визуальное выделение компонентов
- ✅ **Persistent Storage**: localStorage для настроек

#### Fundamental Limitations
- ❌ **Cross-Tab Inspection**: Может работать только в текущей вкладке
- ❌ **Popup UI**: Нет отдельного popup окна
- ❌ **Background Processing**: Нет background script для complex operations
- ❌ **Extension APIs**: Нет доступа к chrome.* APIs

#### Why These Limitations?

**Same-Origin Policy**: Bookmarklet не может обходить CORS restrictions для инспекции других вкладок.

**No Background Script**: Standalone режим работает в контексте страницы, без privileged background context.

**Security Model**: Браузеры правильно ограничивают возможности bookmarklets для безопасности.

### Deployment & Distribution

#### Static File Serving
```bash
# Build the project
npm run build

# Serve dist/ directory with CORS enabled
npx serve dist -p 5174 --cors
```

#### Bookmarklet Generation (`dist/standalone/index.html`)
- JavaScript code для bookmarklet генерируется автоматически
- Содержит minified bootstrap code с конфигом
- Работает offline после начальной загрузки

#### Enterprise Deployment
- Файлы можно разместить на корпоративном HTTP сервере
- CORS headers необходимы для cross-origin работы
- HTTPS рекомендуется для security

### Security Considerations

**Content Security Policy**: Standalone режим должен работать в рамках CSP целевого приложения.

**Cross-Origin Communication**: postMessage используется с proper origin checking.

**Data Isolation**: localStorage keys namespaced для избежания конфликтов.

**No Privilege Escalation**: Standalone режим не получает дополнительных привилегий по сравнению с обычным JavaScript на странице.

## Capabilities & Limitations

Vue Inspector работает в двух runtime с разными возможностями. Эти различия выражены через `RuntimeCapabilities` интерфейс.

### Capability Matrix

| Capability | Extension | Standalone | Rationale |
|------------|-----------|------------|-----------|
| `hasBackgroundScript` | ✅ | ❌ | Extension имеет privileged background context |
| `hasPopup` | ✅ | ❌ | Extension может открывать popup UI |
| `canInspectOtherTabs` | ✅ | ❌ | Same-origin policy ограничивает bookmarklets |
| `hasPersistentStorage` | ✅ | ✅ | Оба runtime поддерживают персистентное хранение |
| `mode` | `'extension'` | `'standalone'` | Runtime identifier для UI |

### UI Adaptation Patterns

**Conditional Features:**
```typescript
// В Core компонентах
const capabilities = useCapabilities()

// Скрыть кнопку если нельзя инспектировать другие вкладки
if (!capabilities.canInspectOtherTabs) {
  return null // Кнопка не рендерится
}

// Показать badge с режимом
<div class="mode-badge" v-if="capabilities.mode === 'standalone'">
  Standalone Mode
</div>
```

**Graceful Degradation:**
```typescript
// В composables
async function inspectOtherTab(tabId: string) {
  if (!capabilities.canInspectOtherTabs) {
    throw new Error('Cross-tab inspection not supported in current runtime')
  }

  // Extension-specific logic
  return await runtime.sendMessage({
    type: 'INSPECT_TAB',
    tabId
  })
}
```

**Capability-Driven Defaults:**
```typescript
// Разные дефолтные настройки для разных runtime
const defaultSettings = computed(() => ({
  autoRefresh: capabilities.hasBackgroundScript, // Только в extension
  persistLayout: capabilities.hasPersistentStorage, // В обоих
  crossTabSync: capabilities.canInspectOtherTabs // Только в extension
}))
```

### Storage Differences

**Extension Storage:**
- `chrome.storage.local` — локальное хранилище на устройстве (не синхронизируется)
- `chrome.storage.sync` — синхронизируется между устройствами (опционально)
- Shared между popup, devtools и content scripts
- Persistent между сессиями браузера

**Standalone Storage:**
- `localStorage` с namespaced keys
- Isolated per origin (домен)
- Persistent до manual clear или expiry

### Communication Patterns

**Extension Communication:**
- **Popup ↔ Content Script**: `chrome.tabs.sendMessage()`
- **DevTools ↔ Content Script**: `chrome.tabs.sendMessage()`
- **Injected UI ↔ Content Script**: `window.postMessage()` с parent window
- **Background Script**: Privileged coordination layer для routing и privileged APIs

**Standalone Communication:**
- **Injected UI ↔ Content Script**: `window.postMessage()` с prefixed messages
- **Request-Response**: С explicit timeout handling
- **Broadcast**: Для reactive updates
- **No Background**: Все операции в контексте страницы

### Performance Characteristics

**Extension Mode:**
- Faster initial load (pre-injected content scripts)
- Background script для privileged APIs и cross-tab coordination
- Cross-tab communication через privileged APIs

**Standalone Mode:**
- Slower initial load (dynamic script injection)
- All processing in main thread
- Limited to single tab
- More susceptible to page JavaScript interference

### Error Handling

**Network Errors:**
- Extension: Graceful fallback, background retry
- Standalone: User-visible errors, manual retry

**Timeout Handling:**
- Extension: Background script может продолжать операции
- Standalone: Hard timeouts, potential data loss

**Capability Violations:**
- Design-time prevention через conditional rendering
- Runtime checks с meaningful error messages

## Architectural Principles

Эти принципы — инварианты архитектуры, которые нельзя нарушать без серьезных оснований.

### Core Invariants

#### 1. Single Source of Truth
**Вся бизнес-логика инспекции пишется один раз в Core.** Нет дублирования кода между runtime. Extension и standalone используют идентичный Core код.

**Implication:** Новые features добавляются только в Core, автоматически работают во всех runtime.

#### 2. No Platform Conditionals in Core
**Core код не содержит `if (capabilities.mode === 'standalone')`.** Различия между runtime выражаются только через capabilities, никогда через runtime detection.

**Bad Example:**
```typescript
// ❌ Anti-pattern
if (runtime.id === 'standalone') {
  // Standalone-specific logic
}
```

**Good Example:**
```typescript
// ✅ Capability-driven
if (!capabilities.canInspectOtherTabs) {
  // Handle limitation gracefully
}
```

#### 3. Capability-Driven UI
**UI адаптируется к возможностям runtime через capabilities, а не через hardcoded условия.**

**Pattern:**
```typescript
// В компонентах
const { canInspectOtherTabs, hasPopup } = useCapabilities()

// Conditional rendering
<button v-if="canInspectOtherTabs">Inspect Other Tab</button>

// Conditional behavior
const handleClick = async () => {
  if (!canInspectOtherTabs) {
    showError('Cross-tab inspection not supported')
    return
  }
  // Proceed with inspection
}
```

#### 4. Clean Adapter Interface
**RuntimeAdapter — единственная точка контакта между Core и платформой.** Core не знает о конкретных платформенных APIs.

**Contract:** Все платформенные зависимости инкапсулированы в adapters. Изменения в chrome.* APIs затрагивают только ExtensionAdapter.

### Design Patterns

#### Adapter Factory Pattern (Illustrative Example)
```typescript
// src/runtime/index.ts
export function createRuntimeAdapter(): RuntimeAdapter {
  // Runtime detection logic (when auto-detection is desired)
  if (isExtensionEnvironment()) {
    return createExtensionAdapter()
  } else {
    return createStandaloneAdapter(getStandaloneConfig())
  }
}
```

**Note:** Runtime часто выбирается явно через entry points (standalone bootstrap, extension manifest), но auto-detection возможен где уместен.

#### Message-Based Communication
**Все взаимодействие между UI и inspection logic идет через messages.** Нет direct function calls или shared state.

```typescript
// Core side
const response = await runtime.sendMessage({
  type: 'GET_COMPONENT_TREE',
  componentId: 'root'
})

// Injected side
handleMessage({ type: 'GET_COMPONENT_TREE', componentId }, respond) => {
  const tree = buildComponentTree(componentId)
  respond({ tree })
}
```

#### Lifecycle Management
**Явная инициализация и cleanup всех ресурсов.** Memory leaks предотвращаются через proper teardown.

```typescript
// В composables
onMounted(() => {
  const unsubscribe = runtime.onMessage(handler)
  onUnmounted(() => unsubscribe())
})
```

### Quality Attributes

#### Reliability
- **No Single Points of Failure**: Каждый runtime работает independently
- **Graceful Degradation**: Ограничения capabilities обрабатываются gracefully
- **Error Boundaries**: Runtime errors не ломают всю систему

#### Maintainability
- **Clear Separation of Concerns**: Core, Abstraction, Adapters
- **Interface Stability**: Breaking changes в RuntimeAdapter затрагивают все adapters
- **Incremental Migration**: Новые features можно добавлять без изменения существующих

#### Extensibility
- **New Runtime Support**: Добавление нового runtime = новый adapter
- **Feature Flags**: Новые возможности добавляются через capabilities
- **Backward Compatibility**: Старые adapters продолжают работать

#### Performance
- **Lazy Loading**: Injected modules загружаются только при наличии Vue/Pinia
- **Async Messaging**: Message passing designed for asynchronous communication
- **Memory Management**: Proper cleanup предотвращает leaks

## Explicit Non-Goals / Constraints

Эти ограничения — осознанные решения дизайна, а не технические ограничения.

### Out of Scope

#### 1. Vue Version Compatibility
**Vue Inspector поддерживает только Vue 3.** Vue 2 support не планируется по следующим причинам:

- Vue 2 ecosystem постепенно уходит
- Composition API (Vue 3) лучше подходит для reactive инспекции
- Поддержка обеих версий удвоила бы complexity без значительной пользы

#### 2. Framework Agnosticism
**Vue Inspector жестко привязан к Vue.** Не поддерживает React, Angular или другие фреймворки.

- Специфический knowledge о Vue internals необходим для качественной инспекции
- DevTools hook API специфичен для Vue
- Цель — быть лучшим инструментом для Vue, а не mediocre для всех

#### 3. Production Monitoring
**Vue Inspector — development tool, не production monitoring solution.**

- Не предназначен для production использования
- Не собирает telemetry или analytics
- Не интегрируется с APM системами

#### 4. Plugin Ecosystem
**Vue Inspector не имеет plugin системы.** Все features built-in.

- Core functionality достаточно comprehensive
- Plugin system добавил бы significant complexity
- Community contributions идут через PRs к main codebase

### Technical Constraints

#### 1. Single Tab Limitation (Standalone)
**Standalone режим не может инспектировать другие вкладки.** Это фундаментальное ограничение bookmarklet security model.

**Why not workaround?**
- Cross-origin inspection нарушил бы browser security
- Alternative approaches (shared workers, etc.) не работают reliably
- Corporate environments могут блокировать даже эти workarounds

#### 2. No Background Processing (Standalone)
**Standalone режим не имеет background script.** Все операции выполняются в main thread.

**Implications:**
- Heavy operations могут блокировать UI
- No cross-tab state synchronization
- Limited to current tab lifecycle

#### 3. Storage Limitations
**Standalone использует localStorage, не chrome.storage.**

- No cross-device synchronization
- Storage quota limits (~5-10MB)
- Potential conflicts с application localStorage

### Design Trade-offs

#### 1. Complexity vs Features
**Architecture optimized для maintainability над feature completeness.**

- Некоторые advanced DevTools features не реализованы
- Focus на core inspection use cases
- Simpler codebase = faster development, fewer bugs

#### 2. Performance vs Compatibility
**Standalone режим медленнее extension из-за dynamic loading.**

- Static injection в extension = faster startup
- Dynamic script loading в standalone = slower but more compatible
- Trade-off принят осознанно для corporate compatibility

#### 3. Type Safety vs Runtime Flexibility
**TypeScript используется, но с runtime type checks где необходимо.**

- Vue internals не fully typed
- Runtime adaptation требует flexibility
- Type safety сохраняется где возможно, runtime checks где необходимо

### Future Considerations

#### Potential Future Runtimes
- **Electron Apps**: Мог бы иметь full node.js access
- **Mobile DevTools**: Через WebViews или native bridges
- **SSR Applications**: Теоретическая возможность (значительные архитектурные изменения)

#### Non-Goals That Could Change
- **Vue 2 Support**: Мог бы быть добавлен если будет strong demand
- **Plugin System**: Мог бы быть добавлен для advanced use cases
- **Production Features**: Monitoring capabilities могли бы быть separate product

## Extensibility & Future Runtimes

Архитектура Core + Runtime Adapter designed для легкого добавления новых платформ.

### Adding a New Runtime

#### 1. Implement RuntimeAdapter
```typescript
// src/runtime/new-platform/adapter.ts
export class NewPlatformAdapter implements RuntimeAdapter {
  readonly id = 'new-platform'

  readonly capabilities: RuntimeCapabilities = {
    hasBackgroundScript: true,     // Platform-specific
    hasPopup: false,               // Platform-specific
    canInspectOtherTabs: true,     // Platform-specific
    hasPersistentStorage: true,    // Platform-specific
    mode: 'new-platform'
  }

  // Implement all RuntimeAdapter methods
  getResourceURL(path: string): string { /* ... */ }
  sendMessage<T>(message: Message): Promise<T> { /* ... */ }
  onMessage(handler: MessageHandler): Unsubscribe { /* ... */ }
  onReady(callback: () => void): void { /* ... */ }
  destroy(): void { /* ... */ }
}
```

#### 2. Add to Runtime Detection
```typescript
// src/runtime/index.ts
export function createRuntimeAdapter(): RuntimeAdapter {
  if (isExtensionEnvironment()) {
    return createExtensionAdapter()
  }
  if (isStandaloneEnvironment()) {
    return createStandaloneAdapter(getStandaloneConfig())
  }
  if (isNewPlatformEnvironment()) {
    return createNewPlatformAdapter()
  }
  // Fallback
  throw new Error('Unsupported runtime environment')
}
```

#### 3. Update UI Components (if needed)
Core components автоматически адаптируются через capabilities. Новые runtime могут требовать специфических UI adjustments если имеют уникальные возможности.

### Potential Future Platforms

#### Electron Runtime
```typescript
capabilities: {
  hasBackgroundScript: true,     // Main process
  hasPopup: true,               // Detached windows
  canInspectOtherTabs: true,    // IPC communication
  hasPersistentStorage: true,   // electron-store
  mode: 'electron'
}
```
**Benefits:** Full Node.js access, native file system, cross-window communication.

#### Mobile DevTools Runtime
```typescript
capabilities: {
  hasBackgroundScript: false,    // Limited background processing
  hasPopup: false,              // Overlay UI only
  canInspectOtherTabs: false,   // Single WebView
  hasPersistentStorage: true,   // Mobile storage APIs
  mode: 'mobile'
}
```
**Benefits:** Mobile-optimized UI, native mobile features.

#### Theoretical: SSR/Server Runtime
```typescript
capabilities: {
  hasBackgroundScript: true,     // Server-side processing
  hasPopup: false,              // No browser UI
  canInspectOtherTabs: false,   // Single request context
  hasPersistentStorage: true,   // Database/cache
  mode: 'server'
}
```
**Note:** Theoretical exploration. Vue DevTools hooks не работают полноценно на сервере. Требует значительной адаптации архитектуры.

### Extension Patterns

#### New Capabilities
Если новый runtime имеет уникальные возможности, добавьте их в `RuntimeCapabilities`:

```typescript
interface RuntimeCapabilities {
  // Existing capabilities...
  canAccessFileSystem?: boolean    // For Electron
  hasNativeNotifications?: boolean // For mobile
  supportsSSRInspection?: boolean  // For server runtime
}
```

#### Platform-Specific Features
Core может использовать новые capabilities для conditional features:

```typescript
if (capabilities.canAccessFileSystem) {
  // Show "Export to File" button
}
```

### Architecture Evolution

#### Versioning Strategy
- **RuntimeAdapter Interface**: Semver, breaking changes только в major versions
- **Capabilities**: Добавление новых — minor version, изменение существующих — major
- **Core Features**: Независимое versioning от runtime changes

#### Backward Compatibility
- Старые adapters продолжают работать с новым Core
- Новые capabilities имеют default values
- Deprecation warnings для obsolete capabilities

#### Testing Strategy
- Unit tests для каждого adapter
- Integration tests с mock adapters
- E2E tests для каждого supported runtime
