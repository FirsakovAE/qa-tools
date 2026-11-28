/**
 * Site landing at `{prefix}/index.html`, outside VitePress `base` (`{prefix}/docs/`).
 */
export function resolveRootLandingHref(siteBase: string): string {
  const prefix = siteBase.replace(/\/docs\/$/, '/')
  return prefix === '/' ? '/index.html' : `${prefix.replace(/\/$/, '')}/index.html`
}
