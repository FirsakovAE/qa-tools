import { ref, onMounted, onUnmounted, readonly } from 'vue'
import { toast } from '@/components/ui/Toaster'
import { CustomSimple } from '@/components/ui/Toaster'
import { markRaw } from 'vue'
import { useRuntime } from '@/runtime'

interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
}

const CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
const LAST_CHECK_KEY = 'update-checker-last-check'
const LAST_DISMISSED_KEY = 'update-checker-last-dismissed'

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
  const checkInterval = ref<ReturnType<typeof setInterval> | null>(null)

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

  const shouldShowUpdateToast = async (): Promise<boolean> => {
    try {
      const lastDismissed = await runtime.storage.get<number>(LAST_DISMISSED_KEY)
      if (lastDismissed) {
        const timeSinceDismissed = Date.now() - lastDismissed
        if (timeSinceDismissed < CHECK_INTERVAL) {
          return false
        }
      }
      return true
    } catch (error) {
      console.error('Failed to check last dismissed time:', error)
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

      // Показываем тостер об успешном начале скачивания
      toast.success('Download started', {
        description: 'The update archive is being downloaded.'
      })
    } catch (error) {
      console.error('Failed to download update:', error)
      toast.error('Download failed', {
        description: 'Failed to start download. Please try again.'
      })
    }
  }

  const showUpdateToast = (remoteVersion: string) => {
    const toastId = toast.custom(markRaw(CustomSimple), {
      componentProps: {
        title: 'Update is available',
        description: `Download new version ${remoteVersion}`,
        actionText: 'Download',
        onAction: () => {
          toast.dismiss(toastId)
          downloadUpdate()
        }
      },
      duration: Infinity,
      onDismiss: () => {
        // Сохраняем время когда пользователь закрыл тостер
        runtime.storage.set(LAST_DISMISSED_KEY, Date.now())
      }
    })
  }

  const checkForUpdates = async (showToast = true, force = false) => {
    if (isChecking.value) return

    // Проверяем, нужно ли выполнять проверку (если не force)
    if (!force) {
      const shouldCheck = await shouldCheckForUpdates()
      if (!shouldCheck) {
        console.log('Update check skipped: too soon since last check')
        return
      }
    }

    isChecking.value = true

    try {
      const [localVersion, remoteVersion] = await Promise.all([
        getLocalVersion(),
        getRemoteVersion()
      ])

      console.log('Update check:', { localVersion, remoteVersion })

      // Сохраняем время последней проверки
      await runtime.storage.set(LAST_CHECK_KEY, Date.now())

      // Используем семантическое сравнение версий: remoteVersion > localVersion
      const versionComparison = compareVersions(remoteVersion, localVersion)
      console.log('Version comparison result:', versionComparison, '(> 0 means update available)')

      if (versionComparison > 0 && remoteVersion !== '0.0.0') {
        console.log('Update available!')
        if (showToast) {
          const shouldShow = await shouldShowUpdateToast()
          console.log('Should show toast:', shouldShow)
          if (shouldShow) {
            console.log('Showing update toast')
            showUpdateToast(remoteVersion)
          } else {
            console.log('Toast suppressed (recently dismissed)')
          }
        }
      } else {
        console.log('No update available or invalid remote version')
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
    } finally {
      isChecking.value = false
    }
  }

  const startPeriodicCheck = () => {
    // Проверяем сразу при запуске
    checkForUpdates()

    // Устанавливаем периодическую проверку
    checkInterval.value = setInterval(() => {
      checkForUpdates()
    }, CHECK_INTERVAL)
  }

  const stopPeriodicCheck = () => {
    if (checkInterval.value) {
      clearInterval(checkInterval.value)
      checkInterval.value = null
    }
  }

  onMounted(() => {
    startPeriodicCheck()
  })

  onUnmounted(() => {
    stopPeriodicCheck()
  })

  return {
    isChecking: readonly(isChecking),
    checkForUpdates,
    checkForUpdatesNow: () => checkForUpdates(true, true), // Принудительная проверка с показом тостера
    startPeriodicCheck,
    stopPeriodicCheck
  }
}