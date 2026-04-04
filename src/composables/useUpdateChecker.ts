import { ref, onMounted, readonly, markRaw } from 'vue'
import { toast, CustomUpdateNotification } from '@/components/ui/Toaster'
import { useRuntime } from '@/runtime'
import {
  fetchLatestRelease,
  compareVersions,
  type GitHubRelease,
} from '@/services/githubReleaseService'

const CHECK_INTERVAL = 24 * 60 * 60 * 1000
const LAST_CHECK_KEY = 'update-checker-last-check'
const IGNORED_VERSION_KEY = 'update-checker-ignored-version'

/**
 * Store ignored version so the update toast is suppressed for this specific version.
 * If a new version is released (different from ignored), the condition resets automatically.
 */
export async function ignoreVersion(version: string): Promise<void> {
  const runtime = useRuntime()
  await runtime.storage.set(IGNORED_VERSION_KEY, version)
}


export function useUpdateChecker() {
  const runtime = useRuntime()
  const isChecking = ref(false)

  const getLocalVersion = (): string => {
    try {
      const manifest = runtime.getManifest()
      return manifest?.version || '0.0.0'
    } catch (error) {
      console.error('[useUpdateChecker] Failed to get local version:', error)
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
      console.error('[useUpdateChecker] Failed to check last update time:', error)
      return true
    }
  }

  const isVersionIgnored = async (version: string): Promise<boolean> => {
    try {
      const ignoredVersion = await runtime.storage.get<string>(IGNORED_VERSION_KEY)
      return ignoredVersion === version
    } catch (error) {
      console.error('[useUpdateChecker] Failed to check ignored version:', error)
      return false
    }
  }

  const navigateToAbout = (release: GitHubRelease) => {
    window.dispatchEvent(
      new CustomEvent('vue-inspector:navigate-about', {
        detail: { release },
      })
    )
  }

  const showUpdateToast = (remoteVersion: string, release: GitHubRelease) => {
    try {
      const id = toast.custom(markRaw(CustomUpdateNotification), {
        duration: 10000,
        componentProps: {
          data: {
            id: '',
            title: 'Update Available',
            description: 'Download new version',
            version: remoteVersion,
            onPreview: () => {
              toast.dismiss(id)
              navigateToAbout(release)
            },
            onDismiss: () => {
              toast.dismiss(id)
            },
          },
        },
      })
      return id
    } catch (error) {
      console.error('[useUpdateChecker] Failed to show update toast:', error)
      return null
    }
  }

  const checkForUpdates = async (force = false) => {
    if (isChecking.value) return

    if (runtime.capabilities.mode === 'standalone') return

    if (!force) {
      const shouldCheck = await shouldCheckForUpdates()
      if (!shouldCheck) return
    }

    isChecking.value = true

    try {
      const localVersion = getLocalVersion()
      const result = await fetchLatestRelease()

      await runtime.storage.set(LAST_CHECK_KEY, Date.now())

      if (result.error || !result.release) return

      const remoteVersion = result.release.tag_name.replace(/^v/, '')

      if (
        compareVersions(remoteVersion, localVersion) > 0 &&
        remoteVersion !== '0.0.0'
      ) {
        const ignored = await isVersionIgnored(remoteVersion)
        if (!ignored) {
          showUpdateToast(remoteVersion, result.release)
        }
      }
    } catch (error) {
      console.error('[useUpdateChecker] Failed to check for updates:', error)
    } finally {
      isChecking.value = false
    }
  }

  onMounted(() => {
    checkForUpdates()
  })

  return {
    isChecking: readonly(isChecking),
    checkForUpdates,
    checkForUpdatesNow: () => checkForUpdates(true),
  }
}
