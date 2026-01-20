import { ref, onMounted, onUnmounted, readonly } from 'vue'
import { useRuntime } from '@/runtime'

interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
}

const CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
const LAST_CHECK_KEY = 'update-checker-last-check'

// Функция для семантического сравнения версий
const compareVersions = (version1: string, version2: string): number => {
  const parts1 = version1.split('.').map(Number)
  const parts2 = version2.split('.').map(Number)

  const maxLength = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0

    if (part1 > part2) return 1
    if (part1 < part2) return -1
  }

  return 0
}

export function useUpdateChecker() {
  const runtime = useRuntime()
  const isChecking = ref(false)

  const getLocalVersion = async (): Promise<string> => {
    try {
      const manifest = runtime.getManifest()
      return manifest?.version || '0.0.0'
    } catch (error) {
      console.error('Failed to read local manifest:', error)
      return '0.0.0'
    }
  }

  const getRemoteVersion = async (): Promise<string> => {
    try {
      // Используем GitHub API для получения информации о последнем релизе
      const response = await fetch('https://api.github.com/repos/FirsakovAE/qa-tools/releases/latest')

      if (!response.ok) {
        // 404 означает отсутствие релизов - это нормально, не логируем как ошибку
        if (response.status !== 404) {
          console.warn(`GitHub API returned ${response.status}: ${response.statusText}`)
        }
        return '0.0.0'
      }

      const release: GitHubRelease = await response.json()

      if (!release || !release.tag_name) {
        console.warn('GitHub API response does not contain tag_name:', release)
        return '0.0.0'
      }

      // Убираем 'v' префикс если он есть (например, 'v2.0.0' -> '2.0.0')
      return release.tag_name.replace(/^v/, '')
    } catch (error) {
      console.error('Failed to fetch latest release:', error)
      return '0.0.0'
    }
  }

  const shouldCheckForUpdates = async (): Promise<boolean> => {
    try {
      const lastCheck = await runtime.storage.get<number>(LAST_CHECK_KEY)
      if (lastCheck) {
        const timeSinceLastCheck = Date.now() - lastCheck
        if (timeSinceLastCheck < CHECK_INTERVAL) {
          return false
        }
      }
      return true
    } catch (error) {
      console.error('Failed to check last check time:', error)
      return true
    }
  }


  const downloadUpdate = async () => {
    try {
      // Создаем ссылку для скачивания
      const link = document.createElement('a')
      link.href = 'https://github.com/FirsakovAE/qa-tools/releases/latest/download/qa-tools.zip'
      link.download = 'qa-tools.zip'
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to download update:', error)
    }
  }



  const checkForUpdates = async (force = false) => {
    if (isChecking.value) return

    // Проверяем, нужно ли выполнять проверку (если не force)
    if (!force) {
      const shouldCheck = await shouldCheckForUpdates()
      if (!shouldCheck) {
        return
      }
    }

    isChecking.value = true

    try {
      const [localVersion, remoteVersion] = await Promise.all([
        getLocalVersion(),
        getRemoteVersion()
      ])

      // Сохраняем время последней проверки
      await runtime.storage.set(LAST_CHECK_KEY, Date.now())

      // Используем семантическое сравнение версий: remoteVersion > localVersion
      const versionComparison = compareVersions(remoteVersion, localVersion)

      if (versionComparison > 0 && remoteVersion !== '0.0.0') {
        // Здесь можно добавить логику обработки обновления без показа тостера
        console.log(`Update available: ${remoteVersion} (current: ${localVersion})`)
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
    } finally {
      isChecking.value = false
    }
  }

  onMounted(() => {
    // Проверяем обновления при запуске
    checkForUpdates()
  })

  return {
    isChecking: readonly(isChecking),
    checkForUpdates,
    checkForUpdatesNow: () => checkForUpdates(true) // Принудительная проверка
  }
}