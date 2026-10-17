import { Marked } from 'marked'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeHref(href: string): string | null {
  return /^(https?:|mailto:)/i.test(href.trim()) ? href : null
}

/** Model output is untrusted: raw HTML is shown as text, links open outside the inspector, images become links */
const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text)
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

export function renderMarkdown(text: string): string {
  try {
    return md.parse(text, { async: false }) as string
  } catch {
    return `<p>${escapeHtml(text)}</p>`
  }
}
