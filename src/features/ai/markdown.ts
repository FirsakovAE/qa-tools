import { Marked } from 'marked'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeHref(href: string): string | null {
  return /^(https?:|mailto:)/i.test(href.trim()) ? href : null
}

/** Lucide `copy` and `check`; the button shows the check while it has the `copied` class */
const COPY_ICONS =
  '<svg class="ai-copy-idle" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
  + '<svg class="ai-copy-done" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'

/** Model output is untrusted: raw HTML is shown as text (except line breaks), links open outside the inspector, images become links */
const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text).replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    },
    code({ text, lang }) {
      const language = lang?.match(/^\S+/)?.[0]
      const cls = language ? ` class="language-${escapeHtml(language)}"` : ''
      return `<div class="ai-code"><button type="button" class="ai-code-copy" data-copy-code title="Copy">${COPY_ICONS}</button><pre><code${cls}>${escapeHtml(text)}</code></pre></div>`
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens)
      const url = safeHref(href)
      if (!url) return label
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`
    },
    image({ href, text }) {
      const url = safeHref(href)
      return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text || url)}</a>` : escapeHtml(text)
    },
  },
})

const EVENT_REF = /#(\d{1,6})\b/g

/** `#N` outside links and code blocks becomes a link to the Logs event when the answer resolved it */
function linkEvents(html: string, refs: Record<number, string>): string {
  const root = document.createElement('template')
  root.innerHTML = html
  const walker = document.createTreeWalker(root.content, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!node.parentElement?.closest('a, pre') && EVENT_REF.test(node.data)) nodes.push(node)
    EVENT_REF.lastIndex = 0
  }
  for (const node of nodes) {
    const parts = document.createDocumentFragment()
    let last = 0
    for (const m of node.data.matchAll(EVENT_REF)) {
      const id = refs[Number(m[1])]
      if (!id) continue
      parts.append(node.data.slice(last, m.index))
      const link = document.createElement('a')
      link.className = 'ai-event-ref'
      link.href = '#'
      link.dataset.event = id
      link.title = 'Open in Logs'
      link.textContent = m[0]
      parts.append(link)
      last = m.index + m[0].length
    }
    if (!last) continue
    parts.append(node.data.slice(last))
    node.replaceWith(parts)
  }
  return root.innerHTML
}

export function renderMarkdown(text: string, refs?: Record<number, string>): string {
  let html: string
  try {
    html = md.parse(text, { async: false }) as string
  } catch {
    return `<p>${escapeHtml(text)}</p>`
  }
  return refs ? linkEvents(html, refs) : html
}

/** A finished answer never changes: it is parsed once, not on every render of the chat */
const answers = new Map<string, string>()
const ANSWER_CACHE_SIZE = 200

export function renderAnswer(id: string, text: string, refs?: Record<number, string>): string {
  let html = answers.get(id)
  if (html === undefined) {
    html = renderMarkdown(text, refs)
    if (answers.size >= ANSWER_CACHE_SIZE) answers.delete(answers.keys().next().value!)
    answers.set(id, html)
  }
  return html
}

export function clearAnswerCache(): void {
  answers.clear()
}
