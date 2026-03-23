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
          { text: 'Быстрый старт', link: '/guide/quick-start' },
        ],
      },
      {
        text: 'Props',
        items: [{ text: 'Основы', link: '/props/basics' }],
      },
      {
        text: 'Store',
        items: [{ text: 'Основы', link: '/store/basics' }],
      },
      {
        text: 'Network',
        items: [{ text: 'Основы', link: '/network/basics' }],
      },
      {
        text: 'Options',
        items: [{ text: 'Основы', link: '/options/basics' }],
      },
      {
        text: 'Релизы',
        items: [{ text: '2.0.0', link: '/releases/2.0.0' }],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/FirsakovAE/qa-tools' }],
    footer: {
      message: 'Лицензия GPL-3.0.',
    },
  },
})
