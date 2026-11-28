/**
 * Release info service
 *
 * Reads the static release feed published with the site (`{site}/releases/*.json`, see
 * `scripts/releaseFeed.ts`): Cloudflare first, then GitHub Pages. The GitHub Releases API is the
 * last fallback (ETag caching, 60 unauthenticated requests/hour, unavailable for a private repo).
 */

export interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{
    browser_download_url: string
    name: string
    size: number
  }>
}

export interface ReleaseResult {
  release: GitHubRelease | null
  error: string | null
  rateLimited: boolean
  notModified: boolean
}

export interface ReleaseDisplayInfo {
  type: 'release-notes' | 'update-available' | 'up-to-date'
  body: string
  version: string
  downloadUrl: string | null
  error?: string | null
}

/** `owner/repo` — releases API, repo links, and GitHub Pages project site host/path. */
export const GITHUB_REPO_SLUG = 'FirsakovAE/qa-tools'

/** Site on Cloudflare Pages (`wrangler.jsonc`), no trailing slash. Works when the repository is private. */
export const CLOUDFLARE_SITE_ROOT = 'https://vue-inspector.pages.dev'

const REPO = GITHUB_REPO_SLUG
const API_BASE_URL = `https://api.github.com/repos/${REPO}/releases`

/** `https://github.com/owner/repo` */
export function getGithubRepoUrl(): string {
  return `https://github.com/${GITHUB_REPO_SLUG}`
}

/**
 * Root of the GitHub Pages *project* site (`https://<owner>.github.io/<repo>/`), no trailing slash.
 * Matches project Pages when the repo is published from `gh-pages` / Actions.
 */
export function getGithubPagesProjectSiteRoot(): string {
  const [owner, repo] = GITHUB_REPO_SLUG.split('/')
  if (!owner || !repo) return getGithubRepoUrl()
  return `https://${owner.toLowerCase()}.github.io/${repo.toLowerCase()}`
}

/**
 * English docs entry: home page is the introduction (VitePress `base` = `/docs/`).
 */
export function getPublishedDocsIntroductionUrl(): string {
  return `${CLOUDFLARE_SITE_ROOT}/docs/index.html`
}

const RELEASE_FEED_ROOTS = [
  `${CLOUDFLARE_SITE_ROOT}/releases`,
  `${getGithubPagesProjectSiteRoot()}/releases`,
]

const etagCache = new Map<string, { etag: string; data: GitHubRelease }>()

async function fetchRelease(url: string): Promise<ReleaseResult> {
  const isGithubApi = url.startsWith(API_BASE_URL)
  const headers: Record<string, string> = {}

  // Non-safelisted headers trigger a CORS preflight, which static hosts don't answer (standalone mode).
  const cached = etagCache.get(url)
  if (isGithubApi) {
    headers['Accept'] = 'application/vnd.github.v3+json'
    if (cached?.etag) headers['If-None-Match'] = cached.etag
  }

  try {
    const response = await fetch(url, { headers })

    const remaining = response.headers.get('X-RateLimit-Remaining')
    if (response.status === 403 && remaining === '0') {
      const resetTime = response.headers.get('X-RateLimit-Reset')
      const resetDate = resetTime ? new Date(Number(resetTime) * 1000) : null
      return {
        release: cached?.data ?? null,
        error: `GitHub API rate limit exceeded. Resets at ${resetDate?.toLocaleTimeString() ?? 'unknown'}.`,
        rateLimited: true,
        notModified: false,
      }
    }

    if (response.status === 304) {
      return {
        release: cached?.data ?? null,
        error: null,
        rateLimited: false,
        notModified: true,
      }
    }

    if (!response.ok) {
      if (response.status === 404) {
        return {
          release: null,
          error: 'Release not found.',
          rateLimited: false,
          notModified: false,
        }
      }
      return {
        release: null,
        error: `Release request failed: ${response.status} ${response.statusText}`,
        rateLimited: false,
        notModified: false,
      }
    }

    const release: GitHubRelease = await response.json()
    release.assets = (release.assets ?? []).map(asset => ({
      ...asset,
      browser_download_url: new URL(asset.browser_download_url, url).href,
    }))

    const etag = response.headers.get('ETag')
    if (etag) {
      etagCache.set(url, { etag, data: release })
    }

    return {
      release,
      error: null,
      rateLimited: false,
      notModified: false,
    }
  } catch (error) {
    console.error('[services/githubReleaseService] fetchRelease failed:', url, error)
    return {
      release: null,
      error: error instanceof Error ? error.message : 'Network error',
      rateLimited: false,
      notModified: false,
    }
  }
}

async function fetchFromSources(feedFile: string, apiPath: string): Promise<ReleaseResult> {
  let firstFailure: ReleaseResult | null = null
  for (const root of RELEASE_FEED_ROOTS) {
    const result = await fetchRelease(`${root}/${feedFile}`)
    if (result.release) return result
    firstFailure ??= result
  }
  const api = await fetchRelease(`${API_BASE_URL}/${apiPath}`)
  return api.release || !firstFailure ? api : firstFailure
}

export function fetchReleaseByTag(version: string): Promise<ReleaseResult> {
  const tag = `v${version.replace(/^v/, '')}`
  return fetchFromSources(`${tag}.json`, `tags/${tag}`)
}

export function fetchLatestRelease(): Promise<ReleaseResult> {
  return fetchFromSources('latest.json', 'latest')
}

export function compareVersions(version1: string, version2: string): number {
  const parts1 = version1.split('.').map(Number)
  const parts2 = version2.split('.').map(Number)
  const maxLength = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0

    if (part1 > part2) return 1
    if (part1 < part2) return -1
  }

  return 0
}
