# Git Workflow для Vue Inspector

Минимальный и практичный workflow под реальный проект  
(Vue 3 + TypeScript + Vite, extension + standalone, ветка `master`)

---

## Основные команды

```bash
npm run build                         # Собрать билд (dist/ + docs/)
npm run serve:standalone              # локальный тест корп. версии
git add .                             # Добавить все изменения
git commit -m "chore: update preview build"
git push origin master
```

## Релиз

```bash
# 1. Обновить версию
vim manifest.json                     # x.y.z

# 2. Закоммитить версию
git add manifest.json
git commit -m "release: x.y.z"

# 3. Запушить
git push origin master
```

## Ветки (эксперименты)

```bash
# 1. Создать ветку
git checkout -b experiment/{name}
# 2. МР в ветку
git add src/
git commit -m "wip: pinia rewrite"
# 3. Удалить ветку

git checkout master
git branch -D experiment/pinia-rewrite

# 3. Влить ветку в мастер
git checkout master
git merge experiment/pinia-rewrite
git push origin master
```

## Откат

```bash
git log --oneline # Найти последний рабочий коммит
git reset --hard <commit_hash> # Вернуться к рабочему состоянию
git push --force origin master # Принудительно обновить master (осознанно)
```

## Полезное

```bash
git status                 # Статус репозитория
git log --oneline -10      # Последние коммиты
git branch                 # Текущие ветки
git branch --show-current # Быстро узнать текущую ветку
git checkout master        # Вернуться в стабильную ветку
git pull origin master     # Забрать обновления
```

## Git add

```bash
git status # Посмотреть, что вообще происходит
git add -p # Добавлять изменения по частям (лучший антифейл)
git add src/ # Добавить только исходники
git add dist/ docs/ # Добавить только билд (preview / corporate)
git add manifest.json # Добавить ТОЛЬКО версию (триггер релиза)
git reset # Очистить staging (отменить git add)
git reset filename.ts # Убрать файл из staging
git restore --staged filename.ts # Современный способ убрать файл из staging
git diff # Посмотреть НЕ добавленные изменения
git diff --staged # Посмотреть то, что уже пойдёт в коммит
```

