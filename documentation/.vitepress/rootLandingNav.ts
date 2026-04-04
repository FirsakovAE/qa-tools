/**
 * Repo root landing at `/{repo}/index.html`, outside VitePress `base` (`/{repo}/docs/`).
 */
export function resolveRootLandingHref(siteBase: string): string {
  const prefix = siteBase.replace(/\/docs\/$/, '/')
  return prefix === '/' ? '/index.html' : `${prefix.replace(/\/$/, '')}/index.html`
}
