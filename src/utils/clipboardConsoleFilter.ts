/**
 * vanilla-jsoneditor logs caught clipboard failures with `console.error(e)`.
 * In fenced overlays that surfaces as noisy `[object DOMException]` lines we
 * already handle via UX — silence only clipboard-related DOMException noise.
 */

const BLOCKED_MSG = 'The Clipboard API has been blocked for this frame.'

export function shouldSilenceClipboardConsoleArg(arg: unknown): boolean {
  if (!(arg instanceof DOMException)) return false
  if (arg.message === BLOCKED_MSG) return true
  const name = arg.name
  if (name !== 'NotAllowedError' && name !== 'SecurityError') return false
  return /clipboard/i.test(arg.message)
}

let installed = false

export function installClipboardConsoleNoiseFilter(): void {
  if (installed) return
  installed = true
  if (typeof console === 'undefined') return

  type LogFn = typeof console.error

  const wrap = (original: LogFn): LogFn => {
    const bound = original.bind(console) as LogFn
    return ((...args: unknown[]) => {
      if (
        args.length > 0
        && shouldSilenceClipboardConsoleArg(args[0])
      ) {
        return
      }
      ;(bound as (...a: unknown[]) => void)(...args)
    }) as LogFn
  }

  console.error = wrap(console.error as LogFn)
  console.warn = wrap(console.warn as LogFn)
  console.log = wrap(console.log as LogFn)
}
