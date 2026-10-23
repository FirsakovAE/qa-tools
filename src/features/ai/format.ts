/**
 * Short labels for the AI tab and Options: usage, steps, quota, model state.
 */

import { AUTO_MODEL } from './credentials'
import { latestReportedLimit, modelStatus, reportedLimit, requestsToday, statusLabel, unavailableCount } from './modelStatus'
import type { AiModel, AiProviderId, AiStep, AiUsage } from './types'

/** Some providers stream reasoning made of whitespace or zero-width characters only, also with reasoning off */
export function hasVisibleText(text: string | null | undefined): boolean {
  return !!text && /[^\s\u200b-\u200f\u2028\u2029\u2060\ufeff]/.test(text)
}

export function isToolStep(step: AiStep): boolean {
  return !step.thought && step.tool !== 'Context'
}

export function isShownThought(step: AiStep): boolean {
  return !!step.thought && hasVisibleText(step.summary)
}

export function stepsLabel(steps: AiStep[]): string {
  const tools = steps.filter(isToolStep).length
  const reasoning = steps.some(isShownThought)
  if (!tools) return reasoning ? 'Reasoning' : 'Shared data'
  return `${tools} step${tools === 1 ? '' : 's'}${reasoning ? ' and reasoning' : ''}`
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
  if (provider === 'groq') {
    const latest = auto ? latestReportedLimit('groq') : null
    const reported = auto ? latest : reportedLimit('groq', model)
    const id = auto ? latest?.model : model
    const left = reported && id ? `${modelName(models, id)}: ${reported.remaining} of ${reported.limit} requests left today. ` : ''
    return `${left}Today: ${used} Groq requests; each model has its own daily limit. The logs digest is shorter for the small context.${skippedNote}`
  }
  return `Today: ${used} Gemini requests. Daily limits depend on the model and your Google AI Studio project.${skippedNote}`
}
