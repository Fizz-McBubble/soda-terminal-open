import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerPublicOfflineShell } from './registerPublicOfflineShell'

const releaseId = 'public-20260924'

const validManifest = (id = releaseId) => ({
  releaseId: id,
  publicCoreSeparated: true,
  browserCompute: true,
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('public offline shell registration', () => {
  it.each([408, 429, 502, 503, 404])(
    'marks only transient manifest HTTP %s failures for online recovery',
    async (status) => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
      const recover = vi.fn()
      const register = vi.fn()
      expect(
        await registerPublicOfflineShell({
          publicBuild: true,
          releaseId,
          fetcher: vi.fn().mockResolvedValue(new Response('', { status })),
          serviceWorker: { register },
          onRecoverableFailure: recover,
        }),
      ).toBe(false)
      expect(recover).toHaveBeenCalledTimes(status === 404 ? 0 : 1)
      expect(register).not.toHaveBeenCalled()
    },
  )

  it('bounds a stalled manifest and signals recovery without registering', async () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    const recover = vi.fn()
    const register = vi.fn()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(() => {}))
    const attempt = registerPublicOfflineShell({
      publicBuild: true,
      releaseId,
      fetcher,
      serviceWorker: { register },
      onRecoverableFailure: recover,
    })
    await vi.advanceTimersByTimeAsync(15001)
    expect(await attempt).toBe(false)
    expect(recover).toHaveBeenCalledOnce()
    expect(register).not.toHaveBeenCalled()
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })

  it.each(['TypeError', 'SecurityError'])(
    'recovers registration %s only when it is a network failure and deduplicates message handlers',
    async (errorName) => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
      const recover = vi.fn()
      const register = vi.fn().mockRejectedValue(new DOMException('registration failed', errorName))
      const addEventListener = vi.fn()
      const serviceWorker = { register, addEventListener }
      const options = {
        publicBuild: true,
        releaseId,
        fetcher: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => validManifest(),
        }),
        serviceWorker,
        onRecoverableFailure: recover,
      }
      expect(await registerPublicOfflineShell(options)).toBe(false)
      expect(recover).toHaveBeenCalledTimes(errorName === 'TypeError' ? 1 : 0)
      await registerPublicOfflineShell(options)
      expect(addEventListener).toHaveBeenCalledOnce()
    },
  )

  it('leaves an internal build unregistered', async () => {
    const register = vi.fn()
    const fetcher = vi.fn()
    expect(
      await registerPublicOfflineShell({
        publicBuild: false,
        releaseId,
        fetcher: fetcher as unknown as typeof fetch,
        serviceWorker: { register } as unknown as ServiceWorkerContainer,
      }),
    ).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it('requires the same audited release before registration', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    const active = { postMessage: vi.fn() }
    const controller = { postMessage: vi.fn() }
    let onMessage: ((event: MessageEvent) => void) | undefined
    const addEventListener = vi.fn((_type: string, listener: (event: MessageEvent) => void) => {
      onMessage = listener
    })
    const register = vi.fn().mockResolvedValue({ active })
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validManifest(),
    })
    expect(
      await registerPublicOfflineShell({
        publicBuild: true,
        releaseId,
        fetcher: fetcher as unknown as typeof fetch,
        serviceWorker: {
          register,
          addEventListener,
          controller,
        } as unknown as ServiceWorkerContainer,
      }),
    ).toBe(true)
    expect(register).toHaveBeenCalledWith(`/service-worker.js?release=${releaseId}`, {
      scope: '/',
      updateViaCache: 'none',
    })
    expect(active.postMessage).toHaveBeenCalledWith({ type: 'soda-offline-release-tag', releaseId })
    expect(controller.postMessage).toHaveBeenCalledWith({
      type: 'soda-offline-release-tag',
      releaseId,
    })
    const source = { postMessage: vi.fn() }
    onMessage?.({ data: { type: 'soda-offline-release-query' }, source } as unknown as MessageEvent)
    expect(source.postMessage).toHaveBeenCalledWith({ type: 'soda-offline-release-tag', releaseId })
    fetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => validManifest('different-release'),
    })
    const onRecoverableFailure = vi.fn()
    expect(
      await registerPublicOfflineShell({
        publicBuild: true,
        releaseId,
        fetcher: fetcher as unknown as typeof fetch,
        onRecoverableFailure,
        serviceWorker: {
          register,
          addEventListener,
          controller,
        } as unknown as ServiceWorkerContainer,
      }),
    ).toBe(false)
    expect(register).toHaveBeenCalledTimes(1)
    expect(onRecoverableFailure).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'missing browserCompute in community build',
      env: 'true',
      manifest: { releaseId, publicCoreSeparated: true },
    },
    {
      name: 'false browserCompute in community build',
      env: 'true',
      manifest: { releaseId, publicCoreSeparated: true, browserCompute: false },
    },
    {
      name: 'missing publicCoreSeparated in public build',
      env: 'false',
      manifest: { releaseId, browserCompute: true },
    },
    {
      name: 'false publicCoreSeparated in public build',
      env: 'false',
      manifest: { releaseId, publicCoreSeparated: false, browserCompute: true },
    },
  ])('rejects registration when carrier marker is invalid ($name)', async ({ env, manifest }) => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    vi.stubEnv('VITE_SODA_COMMUNITY_BUILD', env)
    const register = vi.fn()
    const onRecoverableFailure = vi.fn()
    const result = await registerPublicOfflineShell({
      publicBuild: true,
      releaseId,
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => manifest,
      }) as unknown as typeof fetch,
      serviceWorker: { register } as unknown as ServiceWorkerContainer,
      onRecoverableFailure,
    })
    expect(result).toBe(false)
    expect(register).not.toHaveBeenCalled()
    expect(onRecoverableFailure).not.toHaveBeenCalled()
  })
})
