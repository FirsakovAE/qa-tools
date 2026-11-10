/**
 * Short labels for the AI tab and Options: usage, steps, quota, model state.
 */

import { AUTO_MODEL } from './credentials'
import { modelStatus, reportedLimit, requestsToday, statusLabel, unavailableCount } from './modelStatus'
import type { AiModel, AiProviderId, AiStep, AiUsage } from './types'

/** Some providers stream reasoning made of whitespace or zero-width characters only */
export function hasVisibleText(text: string | null | undefined): boolean {
  return !!text && /[^\s\u200b-\u200f\u2028\u2029\u2060\ufeff]/.test(text)
}

export function isToolStep(step: AiStep): boolean {
  return !step.thought && step.tool !== 'Context'
}

export function isShownThought(step: AiStep): boolean {
  return !!step.thought && hasVisibleText(step.summary)
}

/**
 * Collapsed tally of an answer's tool calls, in the order a person scans them.
 * Cursor's "files / searches / Grepped / Read", mapped onto Vue Inspector:
 * page code, log searches, code search, event details, the live page.
 */
const ACTION_TALLY: Array<{ id: string; text: (n: number) => string }> = [
  { id: 'files', text: n => `${n} ${n === 1 ? 'file' : 'files'}` },
  { id: 'searches', text: n => `${n} ${n === 1 ? 'search' : 'searches'}` },
  { id: 'grepped', text: n => `Grepped ${n}` },
  { id: 'events', text: n => `Read ${n} ${n === 1 ? 'event' : 'events'}` },
  { id: 'page', text: n => `${n} ${n === 1 ? 'page' : 'pages'}` },
  { id: 'stores', text: n => `${n} ${n === 1 ? 'store' : 'stores'}` },
  { id: 'docs', text: n => `${n} ${n === 1 ? 'doc' : 'docs'}` },
  { id: 'skills', text: n => `${n} ${n === 1 ? 'skill' : 'skills'}` },
]

function actionId(step: AiStep): string | undefined {
  if (step.thought || step.declined) return
  const summary = step.summary
  switch (step.tool) {
    case 'Logs':
      if (summary.startsWith('Search') || summary.startsWith('Find items')) return 'searches'
      if (summary.startsWith('Event details') || summary.startsWith('Read #')) return 'events'
      return
    case 'Sources':
      if (summary.startsWith('Search code')) return 'grepped'
      if (summary.startsWith('List files') || summary.startsWith('Read ')) return 'files'
      return
    case 'Page':
      if (summary.startsWith('Store state') || summary.startsWith('List stores')) return 'stores'
      if (summary.startsWith('Inspect')) return 'page'
      return
    case 'Docs':
      return 'docs'
    case 'Skill':
      return 'skills'
    default:
      return
  }
}

/** `2 files · 3 searches · Grepped 1 · Read 4 events`, or empty when nothing was explored */
export function actionSummary(steps: AiStep[]): string {
  const counts = new Map<string, number>()
  for (const step of steps) {
    const id = actionId(step)
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return ACTION_TALLY.filter(item => counts.has(item.id)).map(item => item.text(counts.get(item.id)!)).join(' · ')
}

function kilo(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`
}

export function usageLine(u: AiUsage): string {
  const parts = [`${u.requests} request${u.requests === 1 ? '' : 's'}`]
  if (u.prompt || u.completion) {
    parts.push(`${kilo(u.prompt)} tokens in${u.cached ? ` (${kilo(u.cached)} cached)` : ''}, ${kilo(u.completion)} out`)
  }
  parts.push(`${(u.ms / 1000).toFixed(1)} s`)
  return parts.join(' · ')
}

export function usageTitle(u: AiUsage): string {
  const lines = [
    `Requests to the provider: ${u.requests}`,
    `Prompt tokens: ${u.prompt}${u.cached ? `, ${u.cached} of them cached` : ''}`,
    `Completion tokens: ${u.completion}`,
    `Time: ${(u.ms / 1000).toFixed(1)} s`,
  ]
  if (u.unreported) lines.push(`${u.unreported} of the requests came without token counts`)
  return lines.join('\n')
}

export function modelName(models: AiModel[], id: string): string {
  return id === AUTO_MODEL ? 'Auto' : models.find(m => m.id === id)?.name ?? id
}

export function modelNote(provider: AiProviderId, m: AiModel): string {
  const used = requestsToday(provider, m.id)
  return [m.paid && 'paid', statusLabel(provider, m.id), m.unstable && 'unstable', used && `${used} today`].filter(Boolean).join(' · ')
}

/** Requests of today and the limits the provider reported; every assistant step is one request */
export function quotaLine(provider: AiProviderId, model: string, models: AiModel[]): string {
  const auto = model === AUTO_MODEL
  const used = requestsToday(provider)
  const skipped = auto ? unavailableCount(provider, models) : 0
  const skippedNote = skipped ? ` Auto skips ${skipped} model${skipped === 1 ? '' : 's'} out of quota or unavailable.` : ''
  if (provider === 'openrouter') {
    const limit = reportedLimit('openrouter')?.limit ?? 50
    return `Today: ${used} of ${limit} free OpenRouter requests (counted in this browser). Each assistant step is one request.${skippedNote}`
  }
  return `Today: ${used} Gemini requests. Daily limits depend on the model and your Google AI Studio project.${skippedNote}`
}
