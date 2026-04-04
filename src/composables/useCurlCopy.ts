import { ref } from 'vue'
import { buildCurlCommand, copyToClipboard } from '@/utils/networkUtils'
import type { NetworkEntry } from '@/types/network'

export function useCurlCopy() {
  const curlCopied = ref(false)

  const copyCurl = async (entry: NetworkEntry) => {
    try {
      const curl = buildCurlCommand(entry)
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