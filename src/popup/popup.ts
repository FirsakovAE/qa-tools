import './assets/index.css'
import './assets/json.css'
import './assets/json-viewer.css'
import './assets/prism-json-theme.css'
import './assets/prism-overrides.css'

import { createApp } from 'vue'
import App from '../App.vue'

// Импортируем CSS через JS - Vite добавит их в сборку
import('@/assets/index.css')
import('@/assets/json.css')
import('@/assets/json-viewer.css')
import('@/assets/prism-json-theme.css')
import('@/assets/prism-overrides.css')

createApp(App).mount('#app')