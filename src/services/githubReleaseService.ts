/**
 * GitHub Release API Service
 *
 * Fetches release info from GitHub API with ETag caching and rate limit handling.
 * Unauthenticated limit: 60 requests/hour.
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

const REPO = 'FirsakovAE/qa-tools'
const BASE_URL = `https://api.github.com/repos/${REPO}/releases`

const etagCache = new Map<string, { etag: string; data: GitHubRelease }>()

async function fetchRelease(url: string): Promise<ReleaseResult> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }

  const cached = etagCache.get(url)
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag
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
        error: `GitHub API error: ${response.status} ${response.statusText}`,
        rateLimited: false,
        notModified: false,
      }
    }

    const release: GitHubRelease = await response.json()

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

export function fetchReleaseByTag(version: string): Promise<ReleaseResult> {
  const cleanVersion = version.replace(/^v/, '')
  return fetchRelease(`${BASE_URL}/tags/v${cleanVersion}`)
}

export function fetchLatestRelease(): Promise<ReleaseResult> {
  return fetchRelease(`${BASE_URL}/latest`)
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
