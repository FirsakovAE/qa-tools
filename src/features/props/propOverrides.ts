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
 * Store a Part or Full rule for this target. Part keeps the keys changed in this edit,
 * merged into an existing Part rule. Full replaces the rule with every current prop.
 * An empty result removes the rule. Returns false when nothing was stored or removed.
 */
export function upsertPropOverrideRule(
  settings: BaseInspectorSettings,
  target: PropOverrideTarget,
  scope: PropOverrideRule['scope'],
  mode: 'part' | 'full',
  original: Record<string, unknown>,
  edited: Record<string, unknown>,
  removedKeys: string[]
): boolean {
  if (!Array.isArray(settings.propOverrides)) settings.propOverrides = []
  const changed: Record<string, unknown> = {}
  for (const key of Object.keys(edited)) {
    if (json(edited[key]) !== json(original[key])) changed[key] = edited[key]
  }
  const existing = findPropOverrideRule(settings.propOverrides, target, scope)
  const props: Record<string, unknown> = mode === 'full'
    ? { ...edited }
    : { ...(existing?.mode === 'part' ? existing.props : {}), ...changed }
  if (mode === 'part') for (const key of removedKeys) delete props[key]
  if (!Object.keys(props).length) {
    if (!existing) return false
    settings.propOverrides = settings.propOverrides.filter(rule => rule !== existing)
    return true
  }
  if (existing && existing.mode === mode && json(existing.props) === json(props)) return false
  if (!existing) {
    settings.propOverrides.push({
      id: `po_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      enabled: true,
      host: target.host,
      component: target.component,
      path: [...target.path],
      scope,
      mode,
      props,
      timestamp: new Date().toISOString()
    })
    return true
  }
  existing.mode = mode
  existing.props = props
  existing.enabled = true
  existing.timestamp = new Date().toISOString()
  return true
}
