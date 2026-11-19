import { ref } from 'vue'

/** Tab open in the panel. The AI chat reads it after its own tab has been unmounted. */
export const activeTabId = ref('props')
