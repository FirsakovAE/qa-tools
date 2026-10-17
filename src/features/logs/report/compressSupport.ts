/** Compressing needs CompressionStream; opening the compressed report needs DecompressionStream */
export function canCompressReport(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'
}
