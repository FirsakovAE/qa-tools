import { ref } from 'vue'
import { buildCurlCommand, copyToClipboard } from '@/utils/networkUtils'
import type { NetworkEntry } from '@/types/network'
import type { BaseInspectorSettings } from '@/types/inspector'
import { networkEntryForCurl } from '@/utils/networkAdvancedHeaders'

export function useCurlCopy(
  getSettings?: () => BaseInspectorSettings | null | undefined,
) {
  const curlCopied = ref(false)

  const copyCurl = async (entry: NetworkEntry) => {
    try {
      const s = getSettings?.()
      const e = s ? networkEntryForCurl(entry, s) : entry
      const curl = buildCurlCommand(e)
      const success = await copyToClipboard(curl)
      if (success) {
        curlCopied.value = true
        setTimeout(() => { curlCopied.value = false }, 2000)
      }
      return success
    } catch (error) {
      console.error('[useCurlCopy] Failed to copy cURL command:', error)
      return false
    }
  }

  return {
    curlCopied,
    copyCurl
  }
}