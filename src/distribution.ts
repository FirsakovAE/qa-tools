/** Chrome Web Store package (`vite build --mode chrome`). No self-update and no sideload links. */
export const isChromeStoreBuild = import.meta.env.MODE === 'chrome'
