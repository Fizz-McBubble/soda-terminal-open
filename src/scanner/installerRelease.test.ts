import { afterEach, expect, it, vi } from 'vitest'
import release from '../../public/downloads/scanner-installer-release.v1.json'
import {
  installerReleaseUrl,
  parseInstallerRelease,
  readInstallerRelease,
} from './installerRelease'

afterEach(() => vi.unstubAllGlobals())

it('binds the published version, save name, same-origin alias, size and full hash', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(release))
  vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController().signal
  await expect(readInstallerRelease(signal)).resolves.toEqual({
    version: release.version,
    helperVersion: release.helperVersion,
    fileName: `Soda-画面扫描-${release.version}.exe`,
    downloadUrl: '/downloads/Soda-Scanner-Setup.exe',
    size: release.size,
    sha256: release.sha256,
  })
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(installerReleaseUrl, {
    credentials: 'omit',
    cache: 'no-store',
    mode: 'same-origin',
    redirect: 'error',
    signal,
  })
})

it.each([
  null,
  [],
  'release',
  { ...release, schemaVersion: 2 },
  { ...release, releaseState: 'not_published' },
  { ...release, version: '1.0.9\n' },
  { ...release, version: '01.0.9' },
  { ...release, helperVersion: '../2.3.11' },
  { ...release, releaseTag: 'scanner-installer-v0.0.1' },
  { ...release, assetName: '../Soda-Scanner-Setup.exe' },
  { ...release, assetUrl: 'javascript:alert(1)' },
  { ...release, assetUrl: release.assetUrl.replace('github.com', 'github.com.evil.test') },
  { ...release, assetUrl: `${release.assetUrl}?redirect=evil` },
  { ...release, assetUrl: release.assetUrl.replace('https:', 'http:') },
  { ...release, size: 1 },
  { ...release, size: 8.1 },
  { ...release, size: '8' },
  { ...release, size: 1024 * 1024 * 1024 + 1 },
  { ...release, sha256: 'abc' },
  { ...release, sha256: 'x'.repeat(64) },
  { ...release, sha256: undefined },
])('rejects unknown or unsafe release data %#', (value) => {
  expect(() => parseInstallerRelease(value)).toThrow('invalid_installer_release')
})

it('rejects HTTP failures and malformed JSON without using the static release', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
  await expect(readInstallerRelease(new AbortController().signal)).rejects.toThrow(
    'installer_release_unavailable',
  )
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json')))
  await expect(readInstallerRelease(new AbortController().signal)).rejects.toThrow()
})

it('cancels a non-settling manifest fetch and disposes its late response', async () => {
  let finish!: (value: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
    ),
  )
  const controller = new AbortController()
  const pending = readInstallerRelease(controller.signal)
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  const cancel = vi.fn()
  finish(new Response(new ReadableStream({ cancel })))
  await Promise.resolve()
  expect(cancel).toHaveBeenCalledOnce()
})
