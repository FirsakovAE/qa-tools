import type { PropOverrideRule } from '@/types/inspector'
import type { PropOverrideSyncRule } from '@/injected/props/overrides-engine'

export const PROP_OVERRIDES_SYNC = 'PROP_OVERRIDES_SYNC'

/** Rules the page should apply right now */
export function propOverridesToSync(
  rules: PropOverrideRule[] | undefined,
  enabled: boolean | undefined
): PropOverrideSyncRule[] {
  if (enabled === false || !Array.isArray(rules)) return []
  return rules
    .filter(rule => rule.enabled)
    .map(rule => ({
      id: rule.id,
      host: rule.host,
      component: rule.component,
      path: [...rule.path],
      scope: rule.scope,
      props: JSON.parse(JSON.stringify(rule.props ?? {}))
    }))
}

/** "App › Layout › Card" — the tree route a 'path' rule is bound to */
export function propOverridePathLabel(rule: Pick<PropOverrideRule, 'component' | 'path'>): string {
  return [...rule.path, rule.component].join(' › ')
}
