/**
 * Expected errors that occur in normal operation and should not be logged.
 * - Extension/port: popup closed, page reloaded, extension updated
 * - Cross-origin: iframe cannot access parent when origins differ
 */
export function isExpectedExtensionError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '')
  return (
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection') ||
    msg.includes('Extension context invalidated') ||
    msg.includes('disconnected port') ||
    msg.includes('Attempting to use a disconnected port') ||
    msg.includes('Port disconnected')
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
