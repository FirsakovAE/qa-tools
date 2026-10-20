import { ref } from 'vue'

/** Event another tab asked to show; the Logs tab selects it and clears the request */
export const pendingLogsEvent = ref<string | null>(null)

export function openLogsEvent(id: string): void {
  pendingLogsEvent.value = id
}
