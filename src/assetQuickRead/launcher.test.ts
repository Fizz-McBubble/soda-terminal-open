import { describe, expect, it, vi } from 'vitest'
import {
  AssetQuickReadUnavailableError,
  assetQuickReadLaunchUri,
  awaitAssetQuickReadService,
} from './launcher'
import { assetQuickReadDownloadAvailable, assetQuickReadRelease } from './distribution'
const missing = () => new AssetQuickReadUnavailableError('synthetic missing service')
it('opens release downloads only with complete fixed release metadata', () => {
  const valid = { ...assetQuickReadRelease, available: true, size: 8, sha256: 'a'.repeat(64) }
  expect(assetQuickReadDownloadAvailable(valid)).toBe(true)
  for (const override of [
    { size: null },
    { sha256: null },
    { available: false },
    { downloadUrl: 'https://unsafe.invalid/setup.exe' },
    { version: '2.0.0' },
  ])
    expect(assetQuickReadDownloadAvailable({ ...valid, ...override })).toBe(false)
})
describe('click-scoped independent service launcher', () => {
  it('probes an already running service without opening a protocol or starting capture', async () => {
    const probe = vi.fn().mockResolvedValue('healthy')
    const protocolLauncher = vi.fn()
    expect(
      await awaitAssetQuickReadService({ probe, protocolLauncher, launchIfMissing: true }),
    ).toBe('healthy')
    expect(protocolLauncher).not.toHaveBeenCalled()
    expect(assetQuickReadLaunchUri).toBe('soda-asset-quick-read://launch')
  })
  it('opens the fixed service URI only after an explicit launch-capable connection probe fails', async () => {
    const probe = vi.fn().mockRejectedValueOnce(missing()).mockResolvedValue('healthy')
    const protocolLauncher = vi.fn()
    const sleep = vi.fn().mockResolvedValue(undefined)
    expect(
      await awaitAssetQuickReadService({ probe, protocolLauncher, sleep, launchIfMissing: true }),
    ).toBe('healthy')
    expect(protocolLauncher).toHaveBeenCalledOnce()
    expect(probe).toHaveBeenCalledTimes(2)
  })
  it('installation return probing cannot open a protocol', async () => {
    const protocolLauncher = vi.fn()
    await expect(
      awaitAssetQuickReadService({ probe: vi.fn().mockRejectedValue(missing()), protocolLauncher }),
    ).rejects.toThrow('synthetic missing')
    expect(protocolLauncher).not.toHaveBeenCalled()
  })
  it('does not launch over a detected incompatible service and bounds missing-service waits', async () => {
    const protocolLauncher = vi.fn()
    await expect(
      awaitAssetQuickReadService({
        probe: vi.fn().mockRejectedValue(new Error('incompatible')),
        protocolLauncher,
        launchIfMissing: true,
      }),
    ).rejects.toThrow('incompatible')
    expect(protocolLauncher).not.toHaveBeenCalled()
    const probe = vi.fn().mockRejectedValue(missing())
    await expect(
      awaitAssetQuickReadService({
        probe,
        protocolLauncher,
        launchIfMissing: true,
        sleep: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toThrow('先下载并完成安装')
    expect(probe).toHaveBeenCalledTimes(87)
    expect(protocolLauncher).toHaveBeenCalledOnce()
  })
  it('an aborted connection cannot launch or continue polling', async () => {
    const abort = new AbortController()
    const protocolLauncher = vi.fn()
    abort.abort()
    const probe = vi.fn()
    await expect(
      awaitAssetQuickReadService({
        probe,
        protocolLauncher,
        launchIfMissing: true,
        signal: abort.signal,
      }),
    ).rejects.toThrow()
    expect(probe).not.toHaveBeenCalled()
    expect(protocolLauncher).not.toHaveBeenCalled()
  })
  it('retries until the service becomes ready within the bounded deadline (e.g. 6s cold start)', async () => {
    vi.useFakeTimers()
    const began = Date.now()
    const launch = vi.fn()
    const probe = vi.fn(async () => {
      if (Date.now() - began < 6000) throw missing()
      return 'ready'
    })
    const pending = awaitAssetQuickReadService({
      probe,
      protocolLauncher: launch,
      launchIfMissing: true,
    })
    await vi.advanceTimersByTimeAsync(2800)
    expect(launch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(3500)
    await expect(pending).resolves.toBe('ready')
    expect(launch).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
  it('fails only after the full bounded deadline (approx 30s) is exhausted', async () => {
    vi.useFakeTimers()
    const launch = vi.fn()
    const probe = vi.fn().mockRejectedValue(missing())
    const pending = awaitAssetQuickReadService({
      probe,
      protocolLauncher: launch,
      launchIfMissing: true,
    })
    await vi.advanceTimersByTimeAsync(29000)
    expect(launch).toHaveBeenCalledOnce()
    const rejected = expect(pending).rejects.toThrow('资产快读尚未启动')
    await vi.advanceTimersByTimeAsync(2000)
    await rejected
    expect(launch).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
