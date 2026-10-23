/**
 * Live page for the assistant: UI elements with their state, the component that renders them,
 * its current values and handler code, and the current state of the stores. Reads the page as
 * it is now, beyond what the logs captured.
 */

import { getRuntimeAdapter } from '@/runtime'
import type { InspectResult, PropOrigin, ReactiveRead, RenderDependencies, RenderDependency, StoresResult } from '@/injected/ai/page-inspect'
import { aiCredentials } from './credentials'
import { protectAppData } from './privacy'

const RESULT_CHARS = 20000

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n... [${text.length - max} chars cut]` : text
}

async function request<T>(message: Record<string, unknown>): Promise<T | { error: string }> {
  const adapter = getRuntimeAdapter()
  if (!adapter) return { error: 'Inspector runtime is not ready' }
  return adapter.sendMessage<T | { error: string }>({ type: String(message.type), ...message }, 8000)
}

function json(value: unknown): string {
  return JSON.stringify(protectAppData(value, { masking: aiCredentials.masking, access: aiCredentials.access }))
}

function formatRead(read: ReactiveRead): string {
  return read.prop ? `props.${read.key} = ${json(read.value)}` : read.key
}

function formatDependency(dep: RenderDependency, indent: string, out: string[]): void {
  out.push(`${indent}- computed${dep.name ? ` ${dep.name}` : ''} = ${json(dep.value)}; code: ${dep.code}`)
  if (dep.reads.length) out.push(`${indent}  reads: ${dep.reads.map(formatRead).join(', ')}`)
  for (const use of dep.uses) formatDependency(use, `${indent}  `, out)
}

/** The template condition in data: in minified code the names are short, these are the real values */
function formatRender(render: RenderDependencies, out: string[]): void {
  out.push('What the template of this component reads now (its v-if / :disabled conditions are built from these; the getter code keeps prop and store field names even when minified):')
  for (const dep of render.computed) formatDependency(dep, '', out)
  if (render.reads.length) out.push(`- read directly by the template: ${render.reads.map(formatRead).join(', ')}`)
}

/** Props grouped by the component that sets them: the binding in its render code or where the value is */
function formatOrigins(origins: PropOrigin[], out: string[]): void {
  const groups = new Map<string, PropOrigin[]>()
  for (const o of origins) {
    const key = `${o.through.join(' < ')}|${o.from ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), o])
  }
  out.push('Where the props come from (render owners up the tree; the binding is the parent render code, its short names are listed by inspect_ui component=<that parent>):')
  for (const list of groups.values()) {
    const { through, from } = list[0]
    const via = through.length ? `passed on unchanged by ${through.join(' < ')}; ` : ''
    out.push(`- ${from ? `${via}set by ${from}:` : `${via}no component above sets them (root props or set at runtime):`}`)
    for (const o of list) {
      const where = o.bindings.length ? o.bindings.map(b => `\`${b}\``).join(' | ')
        : o.found.length ? `passed as part of an object; the key is at ${o.found.map(f => `${f.path} = ${json(f.value)}`).join(', ')}`
        : from ? 'passed as part of an object (v-bind / h()); the key is not in its readable state or the stores' : ''
      out.push(`  - ${o.prop} = ${json(o.value)}${where ? `: ${where}` : ''}`)
    }
    const render = list.find(o => o.render)?.render
    if (render) out.push(`  render code of ${from}: ${render}`)
  }
}

function isEmpty(value: unknown): boolean {
  return !value || (typeof value === 'object' && !Object.keys(value as object).length)
}

export async function inspectUi(args: Record<string, unknown>): Promise<string> {
  const res = await request<InspectResult>({ type: 'AI_INSPECT_UI', text: args.text, selector: args.selector, component: args.component, limit: args.limit })
  if ('error' in res && res.error) return `Could not inspect the page: ${res.error}`
  const { page, total, matches, hints } = res as InspectResult
  if (args.component) {
    if (!matches.length) return `Page: ${page}\nNo mounted component matches "${args.component}". Names come from the component name or its file; production builds may keep only some of them. Inspect an element the component renders (text or selector) to see its chain.`
  }
  const what = args.component
    ? `component "${args.component}"`
    : [args.text && `text "${args.text}"`, args.selector && `selector ${args.selector}`].filter(Boolean).join(' and ')
  if (!matches.length) {
    const out = [
      `Page: ${page}`,
      `No element matches ${what} right now: it is not rendered (v-if / v-else, another route or tab, a closed dialog, not loaded data) or the label differs.`,
      'Next: search_source for the label to find the template (its file is the component), then inspect_ui with component=<that component>: it lists the computeds its template reads with their code and values, the condition is among them.',
    ]
    if (hints?.length) {
      out.push('', 'Elements on the page with words of the text (a notice here often states why the control is missing):')
      for (const h of hints) {
        out.push(`- ${h.element}${h.text ? `: ${h.text}` : ''}${h.blockers.length ? ` [${h.blockers.join('; ')}]` : ''}${h.chain.length ? `\n  component: ${h.chain.join(' < ')}` : ''}`)
      }
    }
    return out.join('\n')
  }
  const out = [`Page: ${page}`, `${total} element${total === 1 ? '' : 's'} match ${what}${total > matches.length ? `, first ${matches.length} shown` : ''}.`]
  matches.forEach((m, i) => {
    out.push('', `## ${i + 1}. ${m.element}`)
    if (m.text) out.push(`Text: ${m.text}`)
    if (!isEmpty(m.attributes)) out.push(`Attributes: ${Object.entries(m.attributes).map(([k, v]) => `${k}="${v}"`).join(' ')}`)
    out.push(m.blockers.length ? `Blocked / hidden: ${m.blockers.join('; ')}` : 'State: enabled, visible, not covered')
    if (m.listeners.length) {
      out.push('Event handlers (code as the page runs it):')
      for (const l of m.listeners) out.push(`- ${l.event} on ${l.on}: ${l.code}`)
    } else {
      out.push('Event handlers: none found on the element and its nearest ancestors (Vue 2 and delegated listeners are not visible here)')
    }
    const c = m.component
    if (!c) {
      out.push('Component: not found (not rendered by Vue)')
      return
    }
    out.push(`Component: ${c.chain.join(' < ')}`)
    if (c.render) formatRender(c.render, out)
    if (c.origins?.length) formatOrigins(c.origins, out)
    if (!isEmpty(c.state)) out.push(`Current values: ${json(c.state)}`)
    else if (i < 2) out.push('Current values: none readable')
    if (c.note) out.push(c.note)
    if (c.methods.length) out.push(`Methods: ${c.methods.join(', ')}`)
    for (const [name, code] of Object.entries(c.related)) out.push(`Code of ${name} (called by the handler): ${code}`)
    if (c.children?.length) out.push(`Child components rendered now (the control may be in one of them; inspect_ui component=<name>): ${c.children.join(', ')}`)
  })
  out.push('', 'Minified handler code: search_source for a distinctive piece of it to get url:line:column, then read_source maps it to the original file.')
  return cut(out.join('\n'), RESULT_CHARS)
}

export async function readStores(args: Record<string, unknown>): Promise<string> {
  const ids = Array.isArray(args.ids) ? args.ids : typeof args.ids === 'string' && args.ids ? [args.ids] : []
  const res = await request<StoresResult>({ type: 'AI_READ_STORES', ids })
  if ('error' in res && res.error) return `Could not read the stores: ${res.error}`
  const { kind, stores, missing } = res as StoresResult
  if (kind === 'none') return 'The page has no Pinia or Vuex store.'
  const out: string[] = []
  if (!ids.length) {
    out.push(`${kind === 'pinia' ? 'Pinia' : 'Vuex'} stores now (pass ids to read the values):`)
    for (const s of stores) {
      const parts = [
        s.stateKeys?.length && `state: ${s.stateKeys.join(', ')}`,
        s.getterKeys?.length && `getters: ${s.getterKeys.join(', ')}`,
        s.actionKeys?.length && `actions: ${s.actionKeys.join(', ')}`,
      ].filter(Boolean)
      out.push(`- ${s.id}${parts.length ? ` (${parts.join('; ')})` : ''}`)
    }
    if (kind === 'vuex') out.push('Vuex: pass module names (top-level state keys) as ids, or "root" for everything.')
    return cut(out.join('\n'), RESULT_CHARS)
  }
  for (const s of stores) {
    out.push(`## ${s.id} (current values)`, `State: ${json(s.state)}`)
    if (!isEmpty(s.getters)) out.push(`Getters: ${json(s.getters)}`)
  }
  if (missing?.length) out.push(`No store with id ${missing.join(', ')}. Call without ids for the list.`)
  return cut(out.join('\n'), RESULT_CHARS)
}
