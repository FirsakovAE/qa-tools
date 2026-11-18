import { ref } from 'vue'
import { catalogs } from './catalogs'
import { en, type MessageKey } from './messages'
import { isUiLanguage, type UiLanguage } from './languages'

export type { MessageKey }
export type { UiLanguage }
export { isUiLanguage, LANGUAGE_LABELS, UI_LANGUAGES } from './languages'

export const locale = ref<UiLanguage>('en')

export function setUiLanguage(language: unknown): void {
  const next = isUiLanguage(language) ? language : 'en'
  locale.value = next
  if (typeof document === 'undefined') return
  document.documentElement.lang = next
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
}

function secondsLabel(n: number): string {
  const language = locale.value
  if (language === 'ru') {
    const mod10 = n % 10
    const mod100 = n % 100
    const word = mod10 === 1 && mod100 !== 11
      ? 'секунда'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'секунды'
        : 'секунд'
    return `${n} ${word}`
  }
  if (language === 'pl') {
    const mod10 = n % 10
    const mod100 = n % 100
    const word = n === 1
      ? 'sekunda'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'sekundy'
        : 'sekund'
    return `${n} ${word}`
  }
  if (language === 'ar') {
    if (n === 1) return 'ثانية واحدة'
    if (n === 2) return 'ثانيتان'
    if (n >= 3 && n <= 10) return `${n} ثوانٍ`
    return `${n} ثانية`
  }
  const forms: Record<Exclude<UiLanguage, 'ru' | 'pl' | 'ar'>, [string, string]> = {
    en: ['second', 'seconds'],
    es: ['segundo', 'segundos'],
    'zh-CN': ['秒', '秒'],
    de: ['Sekunde', 'Sekunden'],
    fr: ['seconde', 'secondes'],
    ja: ['秒', '秒'],
    'pt-BR': ['segundo', 'segundos'],
    ko: ['초', '초'],
    it: ['secondo', 'secondi'],
    tr: ['saniye', 'saniye'],
  }
  const [one, many] = forms[language]
  if (language === 'zh-CN') return `${n} 秒`
  if (language === 'ja') return `${n}秒`
  if (language === 'ko') return `${n}초`
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

/** Current language. Reads the locale, so a template or computed that calls it updates on switch. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let text = catalogs[locale.value]?.[key] ?? en[key]
  if (!vars) return text
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}

export function useI18n() {
  return { t, locale, seconds: secondsLabel }
}
