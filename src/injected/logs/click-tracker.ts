/**
 * Page click log. One event per primary click, resolved to the control that was activated
 * (a click on an icon inside a button is the button). The XPath is absolute, or id-based when
 * the id is unique and not a generated one. A CSS selector is stored as well: an id or
 * test id when that points at one element, otherwise a short path of tag, name and position.
 */

import { isCaptureEnabled, recordLog } from './core'

const TEXT_MAX = 400
const ATTR_MAX = 200
const CLASS_MAX = 300
const HREF_MAX = 500
const SELECTOR_MAX = 500
const SAME_CLICK_MS = 50
const TEST_ID_ATTRS = ['data-testid', 'data-test', 'data-test-id', 'data-qa']
const CONTROL = 'button, a, input, textarea, select, summary, label, [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"]'
const OWN_UI = '#vue-inspector-ui, #vue-inspector-root, [id^="vue-inspector-"]'

let started = false
let lastKey = ''
let lastAt = 0

function flat(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX)
}

function xpathLiteral(value: string): string {
  if (!value.includes('"')) return `"${value}"`
  if (!value.includes("'")) return `'${value}'`
  const parts = value.split('"')
  return `concat(${parts.map((part, i) => `${i ? `, '"', ` : ''}"${part}"`).join('')})`
}

/** Id stable enough to address the element; generated widget ids are skipped */
function stableId(el: Element): string {
  const id = el.id
  if (!id || id.length > 80) return ''
  if (!/^[A-Za-z][\w-]*$/.test(id)) return ''
  if (/^(radix|reka|headlessui|el-id|vue-inspector)/i.test(id)) return ''
  if (/[0-9a-f]{8,}$/i.test(id) || /-\d{4,}$/.test(id)) return ''
  try {
    if (document.querySelectorAll(`[id="${id}"]`).length !== 1) return ''
  } catch {
    return ''
  }
  return id
}

function xpathOf(el: Element): string {
  const id = stableId(el)
  if (id) return `//*[@id=${xpathLiteral(id)}]`
  const parts: string[] = []
  let node: Element | null = el
  while (node && node.nodeType === 1) {
    const tag = node.tagName.toLowerCase()
    let part = tag
    const parent: Element | null = node.parentElement
    if (parent) {
      let total = 0
      let index = 0
      for (let sib: Element | null = parent.firstElementChild; sib; sib = sib.nextElementSibling) {
        if (sib.tagName !== node.tagName) continue
        total++
        if (sib === node) index = total
      }
      if (total > 1) part += `[${index}]`
    }
    parts.push(part)
    if (tag === 'html') break
    node = parent
  }
  return `/${parts.reverse().join('/')}`
}

function clip(value: string, max: number): string {
  const text = value.trim()
  return text.length > max ? text.slice(0, max) : text
}

function attrValue(el: Element, name: string): string {
  const value = el.getAttribute(name)
  return value ? value.trim() : ''
}

function cssEscape(value: string): string {
  try {
    return CSS.escape(value)
  } catch {
    return value.replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`)
  }
}

function cssAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** data-testid, or the same kind of attribute under another common name */
function testIdAttr(el: Element): { name: string; value: string } | null {
  for (const name of TEST_ID_ATTRS) {
    const value = attrValue(el, name)
    if (value) return { name, value: clip(value, ATTR_MAX) }
  }
  return null
}

function matchesOne(selector: string, el: Element): boolean {
  try {
    const found = document.querySelectorAll(selector)
    return found.length === 1 && found[0] === el
  } catch {
    return false
  }
}

/** Position among element siblings of the same tag; empty when it is the only one */
function nthOfType(el: Element): string {
  const parent = el.parentElement
  if (!parent) return ''
  let total = 0
  let index = 0
  for (let sib = parent.firstElementChild; sib; sib = sib.nextElementSibling) {
    if (sib.tagName !== el.tagName) continue
    total++
    if (sib === el) index = total
  }
  return total > 1 ? `:nth-of-type(${index})` : ''
}

/** One step of a CSS path: stable id, test id, name, otherwise tag and position */
function segment(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const id = stableId(el)
  if (id) return `#${cssEscape(id)}`
  const test = testIdAttr(el)
  if (test) return `${tag}[${test.name}="${cssAttr(test.value)}"]`
  const name = attrValue(el, 'name')
  if (name && name.length <= 80 && !/["\\\]]/.test(name)) return `${tag}[name="${cssAttr(name)}"]`
  return `${tag}${nthOfType(el)}`
}

/**
 * A locator that survives layout changes better than an absolute XPath.
 * Stops at the first unique id, test id or path.
 */
function cssOf(el: Element): string {
  const id = stableId(el)
  if (id) {
    const sel = `#${cssEscape(id)}`
    if (matchesOne(sel, el)) return sel
  }
  const test = testIdAttr(el)
  if (test) {
    const sel = `[${test.name}="${cssAttr(test.value)}"]`
    if (matchesOne(sel, el)) return sel
  }

  const parts: string[] = []
  let node: Element | null = el
  while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html') {
    const nodeId = stableId(node)
    if (nodeId) {
      parts.unshift(`#${cssEscape(nodeId)}`)
      break
    }
    parts.unshift(segment(node))
    const sel = parts.join(' > ')
    if (matchesOne(sel, el)) return capSelector(sel)
    node = node.parentElement
  }
  return capSelector(parts.join(' > '))
}

function capSelector(selector: string): string {
  if (selector.length <= SELECTOR_MAX) return selector
  const cut = selector.slice(selector.length - SELECTOR_MAX)
  const next = cut.indexOf(' > ')
  return next === -1 ? cut : cut.slice(next + 3)
}

function classNameOf(el: Element): string {
  return clip((el.getAttribute('class') || '').replace(/\s+/g, ' '), CLASS_MAX)
}

/** The type attribute; a button without one is submit, an input uses its resolved type */
function typeOf(el: Element, tag: string, inputType: string): string {
  if (inputType) return inputType
  const explicit = attrValue(el, 'type').toLowerCase()
  if (explicit) return clip(explicit, 40)
  return tag === 'button' ? 'submit' : ''
}

function labelledBy(el: Element): string {
  const aria = el.getAttribute('aria-label')
  if (aria && aria.trim()) return flat(aria)
  const ids = el.getAttribute('aria-labelledby')
  if (ids) {
    const text = ids.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ')
    if (text.trim()) return flat(text)
  }
  if (el.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (label?.textContent?.trim()) return flat(label.textContent)
    } catch { /* id cannot be used in a selector */ }
  }
  const wrap = el.closest('label')
  if (wrap && wrap !== el && wrap.textContent?.trim()) return flat(wrap.textContent)
  const title = el.getAttribute('title')
  return title ? flat(title) : ''
}

function visibleText(el: Element): string {
  try {
    return flat((el as HTMLElement).innerText || el.textContent || '')
  } catch {
    return flat(el.textContent || '')
  }
}

/** Text inside the field or button. Password and hidden values are never stored. */
function controlText(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'input') {
    const input = el as HTMLInputElement
    const type = (input.type || 'text').toLowerCase()
    if (type === 'password' || type === 'hidden') return labelledBy(el)
    if (type === 'checkbox' || type === 'radio' || type === 'file') return labelledBy(el)
    if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image') {
      return flat(input.value || input.alt || '') || labelledBy(el)
    }
    return flat(input.value || '') || flat(input.getAttribute('placeholder') || '') || labelledBy(el)
  }
  if (tag === 'textarea') {
    const area = el as HTMLTextAreaElement
    return flat(area.value || '') || flat(area.getAttribute('placeholder') || '') || labelledBy(el)
  }
  if (tag === 'select') {
    const select = el as HTMLSelectElement
    const selected = Array.from(select.selectedOptions || []).map(option => option.textContent || '').join(', ')
    return flat(selected) || labelledBy(el)
  }
  return visibleText(el) || labelledBy(el)
}

/** The control a click activates: the field a label points at, else the nearest control */
function controlOf(el: Element): Element {
  const label = el.closest('label')
  if (label) {
    const forId = label.getAttribute('for')
    if (forId) {
      const target = document.getElementById(forId)
      if (target) return target
    }
    const nested = label.querySelector('input, textarea, select, button')
    if (nested) return nested
  }
  return el.closest(CONTROL) || el
}

function isOwn(el: Element): boolean {
  return !!el.closest(OWN_UI)
}

function lightTarget(event: MouseEvent): { element: Element; inner: Element } | null {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  let inner: Element | null = null
  for (const node of path) {
    if (!(node instanceof Element)) continue
    if (!inner) inner = node
    if (node.getRootNode() === document) return { element: node, inner }
  }
  const target = event.target
  if (target instanceof Element) return { element: target, inner: target }
  return null
}

function onClick(event: MouseEvent): void {
  if (event.button !== 0) return
  if (!isCaptureEnabled('click')) return
  const found = lightTarget(event)
  if (!found || isOwn(found.element)) return
  const control = controlOf(found.element)
  if (isOwn(control)) return

  const xpath = xpathOf(control)
  const now = Date.now()
  if (xpath === lastKey && now - lastAt < SAME_CLICK_MS) return
  lastKey = xpath
  lastAt = now

  const tag = control.tagName.toLowerCase()
  const inputType = tag === 'input' ? ((control as HTMLInputElement).type || 'text').toLowerCase() : ''
  const text = controlText(control) || (found.inner !== control ? controlText(found.inner) : '')
  const selector = cssOf(control)
  const id = clip(control.id || '', ATTR_MAX)
  const test = testIdAttr(control)
  const ariaLabel = clip(attrValue(control, 'aria-label'), ATTR_MAX)
  const title = clip(attrValue(control, 'title'), ATTR_MAX)
  const className = classNameOf(control)
  const href = clip(attrValue(control, 'href'), HREF_MAX)
  const type = typeOf(control, tag, inputType)
  recordLog({
    kind: 'click',
    key: xpath,
    level: 'info',
    data: {
      xpath,
      text,
      tag,
      ...(selector ? { selector } : {}),
      ...(id ? { id } : {}),
      ...(test ? { testId: test.value, ...(test.name !== 'data-testid' ? { testAttr: test.name } : {}) } : {}),
      ...(ariaLabel ? { ariaLabel } : {}),
      ...(title ? { title } : {}),
      ...(className ? { className } : {}),
      ...(href ? { href } : {}),
      ...(type ? { type } : {}),
      ...(inputType ? { inputType } : {}),
    },
  })
}

export function initClickLogs(): void {
  if (started) return
  started = true
  document.addEventListener('click', onClick, true)
}
