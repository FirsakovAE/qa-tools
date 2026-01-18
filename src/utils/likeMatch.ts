// src/utils/likeMatch.ts

/**
 * SQL-like matcher with %
 *
 * Examples:
 *  ORButton     -> exact
 *  OR%          -> starts with
 *  %OR          -> ends with
 *  %tooltip%    -> contains
 */
export function likeMatch(value: string, pattern: string): boolean {
    const v = value.toLowerCase()
    const p = pattern.toLowerCase()

    // no wildcard → exact
    if (!p.includes('%')) {
        return v === p
    }

    // escape regex special chars except %
    const escaped = p.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')

    // % → .*
    const regex = new RegExp(
        '^' + escaped.replace(/%/g, '.*') + '$',
    )

    return regex.test(v)
}
