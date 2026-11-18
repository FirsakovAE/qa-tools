/** Interface languages. English stays the default until the user picks another one. */
export const UI_LANGUAGES = [
  'en',
  'es',
  'zh-CN',
  'de',
  'fr',
  'ja',
  'pt-BR',
  'ru',
  'ko',
  'it',
  'pl',
  'tr',
  'ar',
] as const

export type UiLanguage = (typeof UI_LANGUAGES)[number]

/** Endonyms, so the name stays recognizable in every interface language. */
export const LANGUAGE_LABELS: Record<UiLanguage, string> = {
  en: 'English',
  es: 'Español',
  'zh-CN': '简体中文',
  de: 'Deutsch',
  fr: 'Français',
  ja: '日本語',
  'pt-BR': 'Português (BR)',
  ru: 'Русский',
  ko: '한국어',
  it: 'Italiano',
  pl: 'Polski',
  tr: 'Türkçe',
  ar: 'العربية',
}

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && (UI_LANGUAGES as readonly string[]).includes(value)
}
