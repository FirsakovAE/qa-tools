/**
 * Expected extension errors that occur during normal operation
 * (e.g. page refresh, tab close, port disconnection).
 * These should not be logged to console.
 */
export function isExpectedExtensionError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '')
  return (
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection') ||
    msg.includes('Extension context invalidated') ||
    msg.includes('disconnected port') ||
    msg.includes('Attempting to use a disconnected port') ||
    msg.includes('Port disconnected') ||
    msg === 'Timeout' ||
    msg.includes('Message timeout')
  )
}

export function isExpectedCrossOriginError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '')
  return (
    msg.includes('cross-origin') ||
    msg.includes('Blocked a frame') ||
    msg.includes('SecurityError')
  )
}
