const taggedContainers = new WeakMap<object, Set<string>>()

/** Registration is deliberately dormant in local/internal builds. */
export async function registerPublicOfflineShell(
  options: {
    publicBuild?: boolean
    releaseId?: string
    fetcher?: typeof fetch
    onRecoverableFailure?: () => void
    serviceWorker?: Pick<ServiceWorkerContainer, 'register'> &
      Partial<Pick<ServiceWorkerContainer, 'addEventListener' | 'controller'>>
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

  // A new worker cannot infer which bundle an already open page is running.
  const taggedReleases = taggedContainers.get(serviceWorker) ?? new Set<string>()
  if (!taggedReleases.has(releaseId)) {
    serviceWorker.addEventListener?.('message', (event: MessageEvent) => {
      if (event.data?.type === 'soda-offline-release-query')
        event.source?.postMessage({ type: 'soda-offline-release-tag', releaseId })
    })
    taggedReleases.add(releaseId)
    taggedContainers.set(serviceWorker, taggedReleases)
  }

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const manifest: unknown = await Promise.race([
      (async () => {
        const response = await (options.fetcher ?? fetch)('/offline-shell-manifest.json', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          if (response.status === 408 || response.status === 429 || response.status >= 500)
            options.onRecoverableFailure?.()
          return undefined
        }
        return response.json()
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new DOMException('Offline manifest timed out', 'TimeoutError'))
        }, 15000)
      }),
    ])
    clearTimeout(timer)
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
    const registration = await serviceWorker.register(
      `/service-worker.js?release=${encodeURIComponent(releaseId)}`,
      {
        scope: '/',
        updateViaCache: 'none',
      },
    )
    const tag = { type: 'soda-offline-release-tag', releaseId }
    registration?.active?.postMessage(tag)
    if (serviceWorker.controller !== registration?.active)
      serviceWorker.controller?.postMessage(tag)
    return true
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      typeof error.name === 'string' &&
      ['TypeError', 'NetworkError', 'AbortError', 'TimeoutError'].includes(error.name)
    )
      options.onRecoverableFailure?.()
    // Offline support is optional; a failed check must not block local data access.
    return false
  } finally {
    clearTimeout(timer)
  }
}
