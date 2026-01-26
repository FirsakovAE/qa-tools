import { ref } from 'vue'
import { buildCurlCommand, copyToClipboard } from '@/utils/networkUtils'
import type { NetworkEntry } from '@/types/network'

export function useCurlCopy() {
  const curlCopied = ref(false)

  const copyCurl = async (entry: NetworkEntry) => {
    const curl = buildCurlCommand(entry)
    const success = await copyToClipboard(curl)
    if (success) {
      curlCopied.value = true
      setTimeout(() => { curlCopied.value = false }, 2000)
    }
    return success
  }

  return {
    curlCopied,
    copyCurl
  }
}