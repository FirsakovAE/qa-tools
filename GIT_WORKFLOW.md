# Git Workflow для Vue Inspector

## 🚀 Быстрый старт

Этот проект использует Vue 3 + TypeScript + Vite для сборки браузерного расширения и standalone версии.

## 📦 Публикация новой сборки

### Автоматическая сборка (рекомендуется)
```bash
# 1. Собираем проект (создает dist/ и docs/ автоматически)
npm run build

# 2. Добавляем собранные файлы
git add dist/ docs/

# 3. Коммитим с понятным сообщением
git commit -m "Release: Update build artifacts v1.x.x"

# 4. Отправляем на GitHub
git push
```

**Результат:**
- ✅ Файлы расширения в `dist/`
- ✅ Standalone версия в `docs/` (GitHub Pages)
- ✅ Автоматическое исправление всех путей

### Ручная сборка
```bash
# Только расширение
npm run build:extension

# Только standalone (GitHub Pages)
npm run build:standalone
```

## 📝 Работа с исходным кодом

### Добавление новых фич
```bash
# 1. Создаем новую ветку для фичи
git checkout -b feature/new-feature-name

# 2. Вносим изменения в src/
# 3. Тестируем локально
npm run dev

# 4. Добавляем изменения
git add src/
# или конкретные файлы
git add src/components/NewComponent.vue src/features/new-feature.ts

# 5. Коммитим с понятным сообщением
git commit -m "feat: add new component for property inspection

- Added NewComponent.vue
- Updated property display logic
- Added unit tests"

# 6. Отправляем на GitHub
git push origin feature/new-feature-name

# 7. Создаем Pull Request на GitHub
```

### Исправление багов
```bash
# 1. Создаем ветку для фикса
git checkout -b fix/bug-name

# 2. Исправляем код в src/
# 3. Добавляем изменения
git add src/

# 4. Коммитим
git commit -m "fix: resolve issue with component rendering

- Fixed null pointer in component logic
- Added error handling for edge cases"

# 5. Отправляем
git push origin fix/bug-name
```

## 🎯 Советы по коммитам

### Хорошие сообщения коммитов
```
feat: add new component for Vue inspection
fix: resolve memory leak in Pinia store detection
docs: update README with installation instructions
style: format code with prettier
refactor: simplify component logic
test: add unit tests for new feature
chore: update dependencies
```

### Что коммитить
```bash
# ✅ Правильно - только исходный код
git add src/
git add public/
git add *.config.js
git add README.md

# ❌ Неправильно - не коммитить собранные файлы вручную
git add dist/  # Автоматически при npm run build
git add docs/  # Автоматически при npm run build
git add node_modules/  # Исключено .gitignore
```

## 🔄 Ежедневный workflow

### Утро - обновление кода
```bash
# Получаем последние изменения
git pull origin main

# Обновляем зависимости
npm install
```

### Вечер - сохранение прогресса
```bash
# Проверяем статус
git status

# Добавляем изменения
git add src/features/new-feature.ts

# Коммитим
git commit -m "feat: implement basic structure for new feature"

# Отправляем
git push
```

## 🐛 Решение проблем

### Файлы случайно добавлены в коммит
```bash
# Убираем из staging area
git reset HEAD filename.js

# Или убираем последние изменения
git reset --soft HEAD~1
```

### Нужно отменить последний коммит
```bash
# Отменить коммит, но сохранить изменения
git reset --soft HEAD~1

# Полностью отменить коммит и изменения
git reset --hard HEAD~1
```

### Конфликты при merge
```bash
# Показать конфликты
git status

# Открыть файлы и разрешить конфликты вручную
# Затем добавить разрешенные файлы
git add resolved-file.js

# Завершить merge
git commit
```

## 📊 Полезные команды

```bash
# Проверить статус
git status

# Посмотреть изменения
git diff
git diff --staged

# История коммитов
git log --oneline
git log --oneline -10

# Создать и переключиться на ветку
git checkout -b new-branch

# Переключиться на существующую ветку
git checkout main

# Удалить ветку
git branch -d branch-name

# Посмотреть ветки
git branch -a

# Отправить ветку на GitHub
git push origin branch-name

# Получить изменения
git pull origin main
```

## ⚠️ Важные правила

1. **Не коммитить `dist/` и `docs/` вручную** - они обновляются автоматически
2. **Всегда проверять `git status`** перед коммитом
3. **Использовать понятные сообщения коммитов**
4. **Создавать отдельные ветки** для новых фич и багфиксов
5. **Регулярно синхронизировать** с main веткой

## 🔗 Ссылки

- [Документация Git](https://git-scm.com/doc)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

---

**Приятной работы с Vue Inspector! 🎉**


🔄 Быстрый релиз (одной командой)

Если хочешь минимальный набор:

npm version 4.5.0 --no-git-tag-version
git add manifest.json
git commit -m "release: 4.5.0"
git push

🧪 Проверка, что релиз реально вышел
gh release list


или в браузере:

https://github.com/FirsakovAE/qa-tools/releases