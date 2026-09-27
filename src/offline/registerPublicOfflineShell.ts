/** Registration is deliberately dormant in local/internal builds. */
export async function registerPublicOfflineShell(
  options: {
    publicBuild?: boolean
    releaseId?: string
    fetcher?: typeof fetch
    serviceWorker?: Pick<ServiceWorkerContainer, 'register'>
  } = {},
): Promise<boolean> {
  const publicBuild =
    options.publicBuild ??
    (import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true' ||
      import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true')
  const releaseId = options.releaseId ?? import.meta.env.VITE_SODA_RELEASE_ID
  if (!publicBuild || !releaseId || !/^[a-zA-Z0-9._-]{8,80}$/.test(releaseId)) return false
  if (typeof window === 'undefined' || !window.isSecureContext) return false
  const serviceWorker = options.serviceWorker ?? navigator.serviceWorker
  if (!serviceWorker) return false

  try {
    const response = await (options.fetcher ?? fetch)('/offline-shell-manifest.json', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!response.ok) return false
    const manifest: unknown = await response.json()
    if (
      typeof manifest !== 'object' ||
      manifest === null ||
      !('releaseId' in manifest) ||
      manifest.releaseId !== releaseId ||
      !('publicCoreSeparated' in manifest) ||
      (import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true'
        ? !('browserCompute' in manifest) || manifest.browserCompute !== true
        : manifest.publicCoreSeparated !== true)
    )
      return false
    await serviceWorker.register(`/service-worker.js?release=${encodeURIComponent(releaseId)}`, {
      scope: '/',
      updateViaCache: 'none',
    })
    return true
  } catch {
    // Offline support is optional; a failed check must not block local data access.
    return false
  }
}
