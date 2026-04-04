import type { EnhanceAppContext } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import VPNavBarRootLandingLink from './VPNavBarRootLandingLink.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.component('VPNavBarRootLandingLink', VPNavBarRootLandingLink)
  },
}
