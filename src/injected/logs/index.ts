/**
 * Logs module — frontend event journal for the Logs tab.
 *
 * Network events (Send request / Receive response) are derived in the UI from the
 * existing network broadcasts; this module covers everything else.
 */

import { initLogsCore } from './core'
import { initPageLogs } from './page-tracker'

export { initPiniaLogs } from './pinia-tracker'
export { initPropsLogs, cleanupPropsLogs } from './props-tracker'

export function initLogsModule(): void {
  if (!initLogsCore()) return
  initPageLogs()
}
