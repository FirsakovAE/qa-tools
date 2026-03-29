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

/** Absolute path to landing at site root (logo only; do not use in nav — VPLink adds base). */
function landingHref(): string {
  const prefix = vitepressBase().replace(/\/docs\/$/, '/')
  return prefix === '/' ? '/index.html' : `${prefix.replace(/\/$/, '')}/index.html`
}

const sharedTheme = {
  logo: { src: '../../icons/icon32.png', alt: 'Vue Inspector' },
  logoLink: { link: landingHref(), target: '_self', rel: 'noopener' } as const,
  siteTitle: 'Vue Inspector',
  socialLinks: [{ icon: 'github' as const, link: 'https://github.com/FirsakovAE/qa-tools' }],
}

const sidebarEn = [
  {
    text: 'Getting started',
    items: [
      { text: 'Introduction', link: '/guide/introduction' },
      { text: 'Installation', link: '/guide/install' },
    ],
  },
  {
    text: 'Network',
    items: [
      { text: 'Working with requests', link: '/network/general' },
      { text: 'Traffic interception', link: '/network/traffic' },
      { text: 'Export collections', link: '/network/export' },
    ],
  },
  {
    text: 'Props',
    items: [
      { text: 'Overview', link: '/props/general' },
      { text: 'Inspect', link: '/props/inspect' },
      { text: 'Favorites', link: '/props/favorite' },
      { text: 'Blacklist', link: '/props/blacklist' },
    ],
  },
  {
    text: 'Store',
    items: [
      { text: 'Overview', link: '/store/general' },
      { text: 'State', link: '/store/state' },
      { text: 'Getters', link: '/store/getters' },
      { text: 'Favorites', link: '/store/favorite' },
    ],
  },
  {
    text: 'Options',
    items: [
      { text: 'Display modes', link: '/options/display_mode' },
      { text: 'Customize', link: '/options/customize' },
      { text: 'Update settings', link: '/options/update_settings' },
      { text: 'Auto run', link: '/options/auto_run' },
      { text: 'Settings management', link: '/options/settings_management' },
    ],
  },
  {
    text: 'Releases',
    items: [
      { text: '2.0.0', link: '/releases/2.0.0' },
      { text: '2.1.0', link: '/releases/2.1.0' },
      { text: '2.2.0', link: '/releases/2.2.0' },
      { text: '2.3.0', link: '/releases/2.3.0' },
      { text: '2.4.0', link: '/releases/2.4.0' },
    ],
  },
]

export default defineConfig({
  base,
  outDir: resolve(__dirname, '../../docs/docs'),
  ignoreDeadLinks: [/^\.\/?(\.\.\/)+index(\.html)?$/],
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'Vue Inspector',
      description: 'Vue Inspector documentation — inspect and control Vue apps in real time.',
      themeConfig: {
        ...sharedTheme,
        nav: [
          { text: 'Home', link: '../../index.html', target: '_self', rel: 'noopener' },
          { text: 'GitHub', link: 'https://github.com/FirsakovAE/qa-tools' },
        ],
        sidebar: sidebarEn,
        footer: { message: 'GPL-3.0 licensed.' },
        search: { provider: 'local', options: { detailedView: true } },
      },
    },
    ru: {
      label: 'Русский',
      lang: 'ru-RU',
      link: '/ru/',
      title: 'Vue Inspector',
      description:
        'Документация Vue Inspector — инспекция и управление Vue-приложениями в реальном времени.',
      themeConfig: {
        ...sharedTheme,
        nav: [
          { text: 'Главная', link: '../../../index.html', target: '_self', rel: 'noopener' },
          { text: 'GitHub', link: 'https://github.com/FirsakovAE/qa-tools' },
        ],
        sidebar: [
          {
            text: 'Приступая к изучению',
            items: [
              { text: 'Введение', link: '/ru/guide/introduction' },
              { text: 'Установка', link: '/ru/guide/install' },
            ],
          },
          {
            text: 'Network',
            items: [
              { text: 'Работа с запросами', link: '/ru/network/general' },
              { text: 'Подмена трафика', link: '/ru/network/traffic' },
              { text: 'Экспорт коллекций', link: '/ru/network/export' },
            ],
          },
          {
            text: 'Props',
            items: [
              { text: 'Основные возможности', link: '/ru/props/general' },
              { text: 'Инспектор', link: '/ru/props/inspect' },
              { text: 'Избранное', link: '/ru/props/favorite' },
              { text: 'Черный список', link: '/ru/props/blacklist' },
            ],
          },
          {
            text: 'Store',
            items: [
              { text: 'Основные возможности', link: '/ru/store/general' },
              { text: 'Работа со State', link: '/ru/store/state' },
              { text: 'Работа с Getters', link: '/ru/store/getters' },
              { text: 'Избранное', link: '/ru/store/favorite' },
            ],
          },
          {
            text: 'Options',
            items: [
              { text: 'Режимы отображения', link: '/ru/options/display_mode' },
              { text: 'Персонализация', link: '/ru/options/customize' },
              { text: 'Параметры обновления', link: '/ru/options/update_settings' },
              { text: 'Автозапуск', link: '/ru/options/auto_run' },
              { text: 'Менеджер настроек', link: '/ru/options/settings_management' },
            ],
          },
          {
            text: 'Релизы',
            items: [
              { text: '2.0.0', link: '/ru/releases/2.0.0' },
              { text: '2.1.0', link: '/ru/releases/2.1.0' },
              { text: '2.2.0', link: '/ru/releases/2.2.0' },
              { text: '2.3.0', link: '/ru/releases/2.3.0' },
              { text: '2.4.0', link: '/ru/releases/2.4.0' },
            ],
          },
        ],
        footer: { message: 'Лицензия GPL-3.0.' },
        search: {
          provider: 'local',
          options: {
            detailedView: true,
            translations: {
              button: {
                buttonText: 'Поиск',
                buttonAriaLabel: 'Поиск по документации (Ctrl+K)',
              },
              modal: {
                displayDetails: 'Показать контекст',
                resetButtonTitle: 'Очистить запрос',
                backButtonTitle: 'Назад',
                noResultsText: 'Ничего не найдено',
                footer: {
                  selectText: 'открыть',
                  selectKeyAriaLabel: 'Enter — открыть выбранный результат',
                  navigateText: 'навигация',
                  navigateUpKeyAriaLabel: 'Стрелка вверх',
                  navigateDownKeyAriaLabel: 'Стрелка вниз',
                  closeText: 'закрыть',
                  closeKeyAriaLabel: 'Escape — закрыть',
                },
              },
            },
          },
        },
      },
    },
  },
})
