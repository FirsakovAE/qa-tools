import type { UiLanguage } from './languages'
import { en, ru, type MessageKey } from './messages'
import es from './locales/es'
import zhCN from './locales/zh-CN'
import de from './locales/de'
import fr from './locales/fr'
import ja from './locales/ja'
import ptBR from './locales/pt-BR'
import ko from './locales/ko'
import it from './locales/it'
import pl from './locales/pl'
import tr from './locales/tr'
import ar from './locales/ar'

export const catalogs: Record<UiLanguage, Record<MessageKey, string>> = {
  en,
  es,
  'zh-CN': zhCN,
  de,
  fr,
  ja,
  'pt-BR': ptBR,
  ru,
  ko,
  it,
  pl,
  tr,
  ar,
}
