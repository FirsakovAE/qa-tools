---
title: About
---

# About

**Options → About** — это раздел с подписью **About**. Настройки инспектора он не меняет.

## Vue Inspector

Текст: **A DevTools extension for inspecting Vue.js applications — components, props, Pinia stores, and network requests.**

**Version** показывает версию расширения. Если в манифесте нет версии или версия ровно `1.0.0`, standalone пишет `standalone_latest`, а расширение — `unknown`.

## Actions

**Release notes** есть всегда. В расширении загружается релиз GitHub с тегом текущей версии. В standalone загружается последний релиз. Пока идёт загрузка, кнопка недоступна.

**Check for updates** есть только в расширении. Загружается последний релиз, и его тег сравнивается с версией из манифеста. Нет версии в манифесте — сравнение идёт с `0.0.0`. Более новый тег открывает **Update Available**. Тот же или более старый тег открывает **Up to Date**.

Карточка закрывается кнопкой назад или Escape.

| Карточка | Что показывает |
| -------- | -------------- |
| **Release Notes** | **Version** и текст заметок. Пустые заметки — **No release notes available.** |
| **Update Available** | **Download new version** и номер версии, затем **What's New**. **Ignore** запоминает эту версию, и всплывающее уведомление об обновлении её пропускает, пока не выйдет другая. **Download** сохраняет первый файл релиза и недоступна, если файла нет |
| **Up to Date** | **You're up to date!** и **Version … is the latest.** Затем **Current Release Notes**, если у релиза есть заметки |

Неудачный запрос показывает ошибку в карточке. Тексты: **Could not determine current version.**, **No release data available.**, **Failed to fetch release notes.**, **Failed to check for updates.**, **Release not found.**, **GitHub API rate limit exceeded. Resets at …**, **GitHub API error:** и статус, либо **Network error**.

## Links

**GitHub** открывает [https://github.com/FirsakovAE/qa-tools](https://github.com/FirsakovAE/qa-tools). **Docs** открывает [https://firsakovae.github.io/qa-tools/docs/index.html](https://firsakovae.github.io/qa-tools/docs/index.html).

## Footer

**© 2026 FirsakovAE**

**GNU General Public License v3.0** открывает [https://www.gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html).

## См. также

* [История релизов](/ru/releases/history)
* [Режимы отображения](/ru/options/display_mode)
