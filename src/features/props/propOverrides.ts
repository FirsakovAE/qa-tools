import { watch, type Ref } from 'vue'
import type { BaseInspectorSettings, PropOverrideRule } from '@/types/inspector'
import type { PropOverrideTarget } from '@/injected/props/overrides-engine'
import { postToContentScript } from '@/utils/postToContentScript'
import { PROP_OVERRIDES_SYNC, propOverridesToSync } from '@/utils/propOverrides'

export function syncPropOverrides(settings: BaseInspectorSettings | null | undefined): void {
  if (!settings) return
  postToContentScript({
    type: PROP_OVERRIDES_SYNC,
    rules: propOverridesToSync(settings.propOverrides, settings.propOverridesEnabled)
  })
}

/** Keeps the page in step with the rules while the view is mounted */
export function usePropOverridesSync(settings: Ref<BaseInspectorSettings | null | undefined>, onSynced?: () => void): void {
  watch(
    () => [settings.value?.propOverrides, settings.value?.propOverridesEnabled] as const,
    () => {
      if (!settings.value) return
      syncPropOverrides(settings.value)
      onSynced?.()
    },
    { deep: true, immediate: true }
  )
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'undefined'
  } catch {
    return String(value)
  }
}

export function findPropOverrideRule(
  rules: PropOverrideRule[],
  target: PropOverrideTarget,
  scope: PropOverrideRule['scope']
): PropOverrideRule | undefined {
  return rules.find(rule =>
    rule.host === target.host &&
    rule.component === target.component &&
    rule.scope === scope &&
    (scope === 'all' || json(rule.path) === json(target.path))
  )
}

/**
 * Replace the rule for this target with a snapshot of the current props,
 * creating or removing it. Returns false when there is nothing to store.
 */
export function upsertPropOverrideRule(
  settings: BaseInspectorSettings,
  target: PropOverrideTarget,
  scope: PropOverrideRule['scope'],
  edited: Record<string, unknown>
): boolean {
  if (!Array.isArray(settings.propOverrides)) settings.propOverrides = []
  const props = { ...edited }
  const existing = findPropOverrideRule(settings.propOverrides, target, scope)
  if (!Object.keys(props).length) {
    if (!existing) return false
    settings.propOverrides = settings.propOverrides.filter(rule => rule !== existing)
    return true
  }
  if (!existing) {
    settings.propOverrides.push({
      id: `po_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      enabled: true,
      host: target.host,
      component: target.component,
      path: [...target.path],
      scope,
      props,
      timestamp: new Date().toISOString()
    })
    return true
  }
  existing.props = props
  existing.enabled = true
  existing.timestamp = new Date().toISOString()
  return true
}
