/**
 * Heuristic: string might be JSON (object/array/primitive). Skips plain text, HTML, placeholders.
 */
export function looksLikeJsonValue(text) {
    const t = text.trim();
    if (!t)
        return false;
    const c = t[0];
    if (c === '{' || c === '[' || c === '"')
        return true;
    if (t === 'true' || t === 'false' || t === 'null')
        return true;
    if (c === '-' || (c >= '0' && c <= '9'))
        return true;
    return false;
}
/** Breakpoint FormData draft serialized as JSON with __formData marker. */
export function looksLikeFormDataDraftJson(text) {
    const t = text.trim();
    return t.startsWith('{') && t.includes('"__formData"');
}
//# sourceMappingURL=jsonGuards.js.map