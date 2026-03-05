// src/utils/likeMatch.ts

/**
 * Wildcard matcher supporting both * and % as wildcards.
 *
 * Examples:
 *  ORButton     -> exact match
 *  OR*  / OR%   -> starts with "OR"
 *  *OR  / %OR   -> ends with "OR"
 *  *tooltip* / %tooltip% -> contains "tooltip"
 */
export function likeMatch(value: string, pattern: string): boolean {
    const v = value.toLowerCase()
    const p = pattern.toLowerCase()

    if (!p.includes('%') && !p.includes('*')) {
        return v === p
    }

    // escape regex special chars except % and *
    const escaped = p.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')

    const regex = new RegExp(
        '^' + escaped.replace(/[%*]/g, '.*') + '$',
    )

    return regex.test(v)
}
