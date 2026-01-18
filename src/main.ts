import { createApp } from 'vue'
import './assets/index.css'
import './assets/json-viewer.css'
import './assets/prism-overrides.css'
import './assets/prism-json-theme.css'
import App from './App.vue'
import { safeRuntime, safeTabs } from './utils/extensionBridge'

const app = createApp(App)
app.mount('#app')

// Функция для снятия подсветки при закрытии popup
async function clearHighlightOnPopupClose() {
  try {
    const runtime = safeRuntime()
    const tabsApi = safeTabs()
    if (!runtime || !tabsApi) return

    // Получаем активную вкладку
    const tabs = await tabsApi.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) return

    // Отправляем сообщение в background script для снятия подсветки
    await runtime.sendMessage({
      type: 'UNHIGHLIGHT_ELEMENT',
      tabId: tabs[0].id
    })
  } catch (error) {
    // Silent error handling
  }
}

// Снимаем подсветку при закрытии popup (beforeunload)
window.addEventListener('beforeunload', clearHighlightOnPopupClose)

// Также снимаем подсветку при потере фокуса popup окном
window.addEventListener('blur', () => {
  // Небольшая задержка, чтобы не конфликтовать с наведением на элементы внутри popup
  setTimeout(clearHighlightOnPopupClose, 100)
})