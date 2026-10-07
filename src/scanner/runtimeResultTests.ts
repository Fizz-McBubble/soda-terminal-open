import { expect, it, vi } from 'vitest'
import { createScannerAssistantRuntime } from './runtime'
import { createNativeFixtureRuntime, helperFetch, nativeIdentity } from './runtime.testFixture'

export function registerRuntimeResultTests() {
  it.each(['/api/result', '/api/result/staging-fixture'])(
    'bounds a stalled read at %s and aborts its fetch',
    async (path) => {
      const otherRequests = helperFetch()
      let signal: AbortSignal | null = null
      const fetchImpl = vi.fn<typeof fetch>((input, init) => {
        if (new URL(String(input)).pathname === path) {
          signal = init?.signal ?? null
          return new Promise(() => {})
        }
        return otherRequests(input, init)
      })
      const runtime = createNativeFixtureRuntime({ fetchImpl, resultRequestTimeoutMs: 20 })
      const read =
        path === '/api/result'
          ? runtime.commands.requestResultFile()
          : runtime.commands.requestResultStaging('staging-fixture')
      await expect(read).rejects.toMatchObject({ name: 'ScannerResultTimeoutError' })
      expect((signal as AbortSignal | null)?.aborted).toBe(true)
      expect(
        fetchImpl.mock.calls.some(([input]) => new URL(String(input)).pathname === '/api/start'),
      ).toBe(false)
    },
  )

  it('cancels before a stalled identity response can send a result request', async () => {
    let resolveIdentity!: (value: Response) => void
    const fetchImpl = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          resolveIdentity = resolve
        }),
    )
    const controller = new AbortController()
    const runtime = createScannerAssistantRuntime({ fetchImpl, resultRequestTimeoutMs: 1000 })
    const read = runtime.commands.requestResultFile(controller.signal)
    controller.abort()
    await expect(read).rejects.toMatchObject({ name: 'AbortError' })
    resolveIdentity(new Response(JSON.stringify(nativeIdentity)))
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchImpl.mock.calls).toHaveLength(1)
  })
}
