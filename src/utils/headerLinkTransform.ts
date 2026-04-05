/**
 * Apply a chain of transform steps separated by `|`, left to right.
 * Syntax matches function calls: trim(), replace("-", ""), prefix("id-"), etc.
 */

function splitCommaArgs(s: string): string[] {
  const args: string[] = []
  let i = 0
  let cur = ''
  let quote: '"' | "'" | null = null
  while (i < s.length) {
    const c = s[i]!
    if (quote) {
      if (c === '\\' && i + 1 < s.length) {
        cur += s[i + 1]!
        i += 2
        continue
      }
      if (c === quote) {
        quote = null
        cur += c
        i++
        continue
      }
      cur += c
      i++
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      i++
      continue
    }
    if (c === ',') {
      args.push(cur.trim())
      cur = ''
      i++
      continue
    }
    cur += c
    i++
  }
  args.push(cur.trim())
  return args
}

function unquoteArg(arg: string): string {
  const t = arg.trim()
  if (t.length >= 2) {
    const q = t[0]!
    if ((q === '"' || q === "'") && t[t.length - 1] === q) {
      const inner = t.slice(1, -1)
      return inner.replace(/\\(.)/g, '$1')
    }
  }
  return t
}

function applyOneTransform(value: string, stepRaw: string): string {
  const step = stepRaw.trim()
  if (!step) return value

  if (/^trim\(\s*\)$/i.test(step)) return value.trim()
  if (/^lowercase\(\s*\)$/i.test(step)) return value.toLowerCase()
  if (/^uppercase\(\s*\)$/i.test(step)) return value.toUpperCase()
  if (/^removeNonDigits\(\s*\)$/i.test(step)) return value.replace(/\D/g, '')

  const call = /^([a-zA-Z_]\w*)\s*\(([\s\S]*)\)\s*$/.exec(step)
  if (!call) return value

  const fn = call[1]!.toLowerCase()
  const inner = call[2]!.trim()

  switch (fn) {
    case 'substring': {
      const args = splitCommaArgs(inner)
      if (args.length < 2) return value
      const start = Number.parseInt(args[0]!.trim(), 10)
      const end = Number.parseInt(args[1]!.trim(), 10)
      if (Number.isNaN(start) || Number.isNaN(end)) return value
      return value.slice(start, end)
    }
    case 'replace': {
      const args = splitCommaArgs(inner)
      if (args.length < 2) return value
      const a = unquoteArg(args[0]!)
      const b = unquoteArg(args[1]!)
      return value.split(a).join(b)
    }
    case 'prefix': {
      const args = splitCommaArgs(inner)
      if (!args.length) return value
      return unquoteArg(args[0]!) + value
    }
    case 'suffix': {
      const args = splitCommaArgs(inner)
      if (!args.length) return value
      return value + unquoteArg(args[0]!)
    }
    default:
      return value
  }
}

export function applyHeaderLinkValueTransform(
  value: string,
  valueTransform: string | undefined | null,
): string {
  let s = String(value ?? '')
  const pipe = String(valueTransform ?? '').trim()
  if (!pipe) return s
  const steps = pipe.split('|').map((x) => x.trim()).filter(Boolean)
  for (const step of steps) {
    s = applyOneTransform(s, step)
  }
  return s
}
