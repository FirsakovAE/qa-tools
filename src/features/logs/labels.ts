import { t, type MessageKey } from '@/i18n'
import { LOG_KINDS, type LogKind } from '@/types/logs'

const KIND_KEY: Record<LogKind, MessageKey> = {
  request: 'log.kind.request',
  response: 'log.kind.response',
  ws: 'log.kind.ws',
  'ws-sent': 'log.kind.ws-sent',
  'ws-received': 'log.kind.ws-received',
  'ws-closed': 'log.kind.ws-closed',
  props: 'log.kind.props',
  emit: 'log.kind.emit',
  store: 'log.kind.store',
  action: 'log.kind.action',
  navigation: 'log.kind.navigation',
  click: 'log.kind.click',
  error: 'log.kind.error',
}

export function logKindLabel(kind: string): string {
  const key = KIND_KEY[kind as LogKind]
  return key ? t(key) : kind
}

export function logKindLabels(): Record<string, string> {
  return Object.fromEntries(LOG_KINDS.map(kind => [kind, logKindLabel(kind)]))
}
