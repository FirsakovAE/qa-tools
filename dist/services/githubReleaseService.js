/**
 * GitHub Release API Service
 *
 * Fetches release info from GitHub API with ETag caching and rate limit handling.
 * Unauthenticated limit: 60 requests/hour.
 */
/** `owner/repo` — releases API, repo links, and GitHub Pages project site host/path. */
export const GITHUB_REPO_SLUG = 'FirsakovAE/qa-tools';
const REPO = GITHUB_REPO_SLUG;
const BASE_URL = `https://api.github.com/repos/${REPO}/releases`;
/** `https://github.com/owner/repo` */
export function getGithubRepoUrl() {
    return `https://github.com/${GITHUB_REPO_SLUG}`;
}
/**
 * Root of the GitHub Pages *project* site (`https://<owner>.github.io/<repo>/`), no trailing slash.
 * Matches project Pages when the repo is published from `gh-pages` / Actions.
 */
export function getGithubPagesProjectSiteRoot() {
    const [owner, repo] = GITHUB_REPO_SLUG.split('/');
    if (!owner || !repo)
        return getGithubRepoUrl();
    return `https://${owner.toLowerCase()}.github.io/${repo.toLowerCase()}`;
}
/**
 * English docs entry: home page is the introduction (VitePress `base` = `/{repo}/docs/`).
 */
export function getPublishedDocsIntroductionUrl() {
    return `${getGithubPagesProjectSiteRoot()}/docs/index.html`;
}
const etagCache = new Map();
async function fetchRelease(url) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
    };
    const cached = etagCache.get(url);
    if (cached?.etag) {
        headers['If-None-Match'] = cached.etag;
    }
    try {
        const response = await fetch(url, { headers });
        const remaining = response.headers.get('X-RateLimit-Remaining');
        if (response.status === 403 && remaining === '0') {
            const resetTime = response.headers.get('X-RateLimit-Reset');
            const resetDate = resetTime ? new Date(Number(resetTime) * 1000) : null;
            return {
                release: cached?.data ?? null,
                error: `GitHub API rate limit exceeded. Resets at ${resetDate?.toLocaleTimeString() ?? 'unknown'}.`,
                rateLimited: true,
                notModified: false,
            };
        }
        if (response.status === 304) {
            return {
                release: cached?.data ?? null,
                error: null,
                rateLimited: false,
                notModified: true,
            };
        }
        if (!response.ok) {
            if (response.status === 404) {
                return {
                    release: null,
                    error: 'Release not found.',
                    rateLimited: false,
                    notModified: false,
                };
            }
            return {
                release: null,
                error: `GitHub API error: ${response.status} ${response.statusText}`,
                rateLimited: false,
                notModified: false,
            };
        }
        const release = await response.json();
        const etag = response.headers.get('ETag');
        if (etag) {
            etagCache.set(url, { etag, data: release });
        }
        return {
            release,
            error: null,
            rateLimited: false,
            notModified: false,
        };
    }
    catch (error) {
        console.error('[services/githubReleaseService] fetchRelease failed:', url, error);
        return {
            release: null,
            error: error instanceof Error ? error.message : 'Network error',
            rateLimited: false,
            notModified: false,
        };
    }
}
export function fetchReleaseByTag(version) {
    const cleanVersion = version.replace(/^v/, '');
    return fetchRelease(`${BASE_URL}/tags/v${cleanVersion}`);
}
export function fetchLatestRelease() {
    return fetchRelease(`${BASE_URL}/latest`);
}
export function compareVersions(version1, version2) {
    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < maxLength; i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        if (part1 > part2)
            return 1;
        if (part1 < part2)
            return -1;
    }
    return 0;
}
//# sourceMappingURL=githubReleaseService.js.map