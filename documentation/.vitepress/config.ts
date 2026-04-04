import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { resolveRootLandingHref } from './rootLandingNav'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Repository segment in GitHub Pages project URLs: https://{user}.github.io/{repo}/ */
function githubPagesRepoSegment(): string {
  const fromEnv = process.env.VITEPRESS_REPO?.trim()
  if (fromEnv) return fromEnv.replace(/^\/+|\/+$/g, '')
  return process.env.GITHUB_REPOSITORY?.split('/')[1]?.trim() || 'qa-tools'
}

/**
 * URL prefix where the VitePress app is mounted (must match GH Pages: /{repo}/docs/).
 * Override with VITEPRESS_BASE=/other/docs/ when needed.
 */
function vitepressBase(): string {
  const fromEnv = process.env.VITEPRESS_BASE?.trim()
  if (fromEnv) return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
  return `/${githubPagesRepoSegment()}/docs/`
}

const base = vitepressBase()

/** Host-root landing `/{repo}/index.html` (outside VitePress `…/docs/`). Logo uses raw href; nav uses `VPNavBarRootLandingLink`. */
function landingHref(): string {
  return resolveRootLandingHref(base)
}

const sharedTheme = {
  /** `documentation/public/icons/` → `{base}icons/icon32.png` (VPImage applies `withBase`). */
  logo: { src: '/icons/icon32.png', alt: 'Vue Inspector' },
  logoLink: { link: landingHref(), target: '_self', rel: 'noopener' } as const,
  siteTitle: 'Vue Inspector',
  socialLinks: [{ icon: 'github' as const, link: 'https://github.com/FirsakovAE/qa-tools' }],
}

const sidebarEn = [
  {
    text: 'Getting started',
    items: [
      { text: 'Introduction', link: '/' },
      { text: 'Installation', link: '/install' },
      { text: 'General UI principles', link: '/general_principles' },
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
    items: [{ text: 'Release notes', link: '/releases/history' }],
  },
]

/** Absolute-from-host paths (include VitePress `base`) — icons under `documentation/public/icons/`. */
function faviconHead(): [string, Record<string, string>][] {
  const prefix = base.replace(/\/$/, '')
  return [
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${prefix}/icons/icon32.png` }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: `${prefix}/icons/icon16.png` }],
    ['link', { rel: 'apple-touch-icon', href: `${prefix}/icons/icon48.png` }],
  ]
}

export default defineConfig({
  base,
  outDir: resolve(__dirname, '../../docs/docs'),
  vite: {
    /** `install/*.svg` + `icons/*.png` (PNG duplicated from `public/icons` for one `publicDir`). */
    publicDir: resolve(__dirname, '../public'),
  },
  head: faviconHead(),
  ignoreDeadLinks: [/^\.\/?(\.\.\/)+index(\.html)?$/],
  /**
   * Local search must live here, not under `locales[*].themeConfig.search`,
   * or the search box / Ctrl+K won’t render (vitepress#3141).
   * Per-locale UI strings: `options.locales`.
   */
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        detailedView: true,
        locales: {
          ru: {
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
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'Vue Inspector',
      description: 'Vue Inspector documentation — inspect and control Vue apps in real time.',
      themeConfig: {
        ...sharedTheme,
        nav: [
          { component: 'VPNavBarRootLandingLink', props: { text: 'Home' } },
          { text: 'GitHub', link: 'https://github.com/FirsakovAE/qa-tools' },
        ],
        sidebar: sidebarEn,
        footer: { message: 'GPL-3.0 licensed.' },
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
          { component: 'VPNavBarRootLandingLink', props: { text: 'Главная' } },
          { text: 'GitHub', link: 'https://github.com/FirsakovAE/qa-tools' },
        ],
        sidebar: [
          {
            text: 'Приступая к изучению',
            items: [
              { text: 'Введение', link: '/ru/' },
              { text: 'Установка', link: '/ru/install' },
              { text: 'Общие принципы интерфейса', link: '/ru/general_principles' },
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
            items: [{ text: 'История релизов', link: '/ru/releases/history' }],
          },
        ],
        footer: { message: 'Лицензия GPL-3.0.' },
      },
    },
  },
})
