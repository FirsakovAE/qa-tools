/**
 * Match store name against favorite pattern (supports wildcards *).
 * Pattern "use*Store" matches "useUserStore", "useAuthStore", etc.
 */
export function matchFavoritePattern(storeName, pattern) {
    if (pattern === storeName)
        return true;
    if (!pattern.includes('*'))
        return false;
    const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
    try {
        return new RegExp(regexStr).test(storeName);
    }
    catch (e) {
        console.error('[utils/piniaFavoritesMatcher] matchFavoritePattern failed:', pattern, e);
        return false;
    }
}
export function isStoreInFavorites(storeName, favorites) {
    if (!favorites?.length)
        return false;
    return favorites.some(f => f.id === storeName ||
        f.name === storeName ||
        matchFavoritePattern(storeName, f.id) ||
        matchFavoritePattern(storeName, f.name));
}
//# sourceMappingURL=piniaFavoritesMatcher.js.map