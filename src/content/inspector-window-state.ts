/**
 * Inspector window state persistence (Standalone)
 * Saves position, size, collapsed to sessionStorage for last-state restore.
 */

export interface InspectorWindowState {
  x: number
  y: number
  width: number
  height: number
  collapsed: boolean
}

const STORAGE_KEY = 'vue-inspector-window-state'

const DEFAULTS: InspectorWindowState = {
  x: 20,
  y: 20,
  width: 420,
  height: 360,
  collapsed: true
}

export function loadWindowState(): InspectorWindowState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<InspectorWindowState>
    return {
      x: typeof parsed.x === 'number' ? parsed.x : DEFAULTS.x,
      y: typeof parsed.y === 'number' ? parsed.y : DEFAULTS.y,
      width: typeof parsed.width === 'number' ? Math.max(280, parsed.width) : DEFAULTS.width,
      height: typeof parsed.height === 'number' ? Math.max(120, parsed.height) : DEFAULTS.height,
      collapsed: typeof parsed.collapsed === 'boolean' ? parsed.collapsed : DEFAULTS.collapsed
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveWindowState(state: Partial<InspectorWindowState>): void {
  try {
    const current = loadWindowState()
    const merged = { ...current, ...state }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch (e) {
    console.error('[inspector-window-state] save failed:', e)
  }
}
