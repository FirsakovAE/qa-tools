import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * URL prefix where the VitePress app is mounted.
 * - Local `serve docs`: http://localhost:5174/docs/ → `/docs/`
 * - GitHub Pages project site: /{repo}/docs/ (set VITEPRESS_BASE or build on GITHUB_REPOSITORY)
 */
function vitepressBase(): string {
  const fromEnv = process.env.VITEPRESS_BASE?.trim()
  if (fromEnv) return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (repo) return `/${repo}/docs/`
  return '/docs/'
}

const base = vitepressBase()

/** Абсолютный путь к лендингу в корне сайта (для логотипа; в nav не использовать — VPLink добавляет base). */
function landingHref(): string {
  const prefix = vitepressBase().replace(/\/docs\/$/, '/')
  return prefix === '/' ? '/index.html' : `${prefix.replace(/\/$/, '')}/index.html`
}

export default defineConfig({
  lang: 'ru-RU',
  title: 'Vue Inspector',
  description: 'Документация Vue Inspector — инспекция и управление Vue-приложениями в реальном времени.',
  base,
  outDir: resolve(__dirname, '../../docs/docs'),
  ignoreDeadLinks: [/^\.\/?(\.\.\/)+index(\.html)?$/],
  themeConfig: {
    // Relative path (no leading /): not passed through withBase(). ../../ → site-root /icons/ on all VP routes.
    logo: { src: '../../icons/icon32.png', alt: 'Vue Inspector' },
    // Логотип: абсолютный путь к лендингу + target (router не перехватывает).
    logoLink: { link: landingHref(), target: '_self', rel: 'noopener' },
    siteTitle: 'Vue Inspector',
    nav: [
      // Два уровня вверх: со страниц /docs/guide/… сразу на лендинг (не на /docs/index.html).
      { text: 'Главная', link: '../../index.html', target: '_self', rel: 'noopener' },
      { text: 'GitHub', link: 'https://github.com/FirsakovAE/qa-tools' },
    ],
    sidebar: [
      {
        text: 'Приступая к изучению',
        items: [
          { text: 'Введение', link: '/guide/introduction' },
          { text: 'Установка', link: '/guide/install' }
        ],
      },
      {
        text: 'Install',
        items: [{ text: 'Расширение браузера', link: '/install/extension' },
          { text: 'Автономное приложение', link: '/install/standalone' }
        ],
      },
      {
        text: 'Network',
        items: [{ text: 'Работа с запросами', link: '/network/general' },
          { text: 'Подмена трафика', link: '/network/traffic' },
          { text: 'Экспорт коллекций', link: '/network/export' }
        ],
      },
      {
        text: 'Props',
        items: [{ text: 'Основные возможности', link: '/props/general' },
          { text: 'Инспектор', link: '/props/inspect' },
          { text: 'Избранное', link: '/props/favorite' },
          { text: 'Черный список', link: '/props/blacklist' }
        ],
      },
      {
        text: 'Store',
        items: [{ text: 'Основные возможности', link: '/store/general' },
          { text: 'Работа со State', link: '/store/state' },
          { text: 'Работа с Getters', link: '/store/getters' },
          { text: 'Избранное', link: '/store/favorite' }
        ],
      },
      {
        text: 'Options',
          items: [{ text: 'Режимы отображения', link: '/options/display_mode' },
          { text: 'Персонализация', link: '/options/customize' },
          { text: 'Параметры обновления', link: '/options/update_settings' },
          { text: 'Автозапуск', link: '/options/auto_run' },
          { text: 'Менеджер настроек', link: '/options/settings_management' }
        ],
      },
      {
        text: 'Релизы',
        items: [
          { text: '2.0.0', link: '/releases/2.0.0' },
          { text: '2.1.0', link: '/releases/2.1.0' },
          { text: '2.2.0', link: '/releases/2.2.0' },
          { text: '2.3.0', link: '/releases/2.3.0' },
          { text: '2.4.0', link: '/releases/2.4.0' }
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/FirsakovAE/qa-tools' }],
    footer: {
      message: 'Лицензия GPL-3.0.',
    },
  },
})
