import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import { webcrypto } from 'node:crypto'
import type { InstallerDownloadCache } from './installerDownloadCache'

const databaseName = 'soda-installer-download-cache-v1'
const chunkSize = 4 * 1024 * 1024
const packageUrl = '/downloads/Soda-Scanner-Setup.exe'
let cacheModule: typeof import('./installerDownloadCache')
const sessions: InstallerDownloadCache[] = []
const controllers: AbortController[] = []
const createObjectURL = vi.fn().mockReturnValue('blob:installer-cache-test')

function executable(size = chunkSize + 8) {
  const bytes = new Uint8Array(size).fill(3)
  bytes.set([0x4d, 0x5a])
  return bytes
}
async function digest(bytes: Uint8Array<ArrayBuffer>) {
  return Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex')
}
function controller() {
  const value = new AbortController()
  controllers.push(value)
  return value
}
async function open(size = chunkSize + 8, sha = 'a'.repeat(64), url = packageUrl) {
  const session = new cacheModule.InstallerDownloadCache(
    cacheModule.installerDownloadIdentity(url, size, sha),
    controller().signal,
  )
  sessions.push(session)
  await session.open()
  return session
}
async function database<T>(read: (db: Dexie) => Promise<T>) {
  const db = new Dexie(databaseName)
  await db.open()
  try {
    return await read(db)
  } finally {
    db.close()
  }
}
async function reload() {
  vi.resetModules()
  cacheModule = await import('./installerDownloadCache')
}
function webLocks() {
  const held = new Map<string, object>()
  const locks = {
    request: vi.fn(
      (name: string, _options: unknown, callback: (lock: object | null) => Promise<void>) => {
        if (held.has(name)) return callback(null)
        const token = { name, mode: 'exclusive' }
        held.set(name, token)
        return callback(token).finally(() => {
          if (held.get(name) === token) held.delete(name)
        })
      },
    ),
  }
  vi.stubGlobal('navigator', { locks })
  return { locks, endDocument: () => held.clear() }
}

beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('navigator', {})
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = vi.fn()
    },
  )
  createObjectURL.mockClear()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await reload()
})
afterEach(async () => {
  for (const item of controllers.splice(0)) item.abort()
  await Promise.all(sessions.splice(0).map((session) => session.close()))
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await Dexie.delete(databaseName)
})

it('restores complete ordered segments after closing and reopening a real IndexedDB connection with empty module memory', async () => {
  const first = await open()
  await first.checkpoint(executable(chunkSize))
  await first.close()
  await reload()
  const resumed = await open()
  expect(resumed.bytes).toBe(chunkSize)
  expect(resumed.chunks[0]!.subarray(0, 2)).toEqual(new Uint8Array([0x4d, 0x5a]))
  await resumed.checkpoint(new Uint8Array(8).fill(4))
  expect(resumed.bytes).toBe(chunkSize + 8)
  expect(await database((db) => db.table('chunks').count())).toBe(2)
  await resumed.discard()
  expect(await database((db) => db.table('entries').count())).toBe(0)
  expect(await database((db) => db.table('chunks').count())).toBe(0)
})

it('normalizes and validates direct cache identities instead of trusting an internal caller', async () => {
  for (const url of [
    'https://other.invalid/downloads/Soda-Scanner-Setup.exe',
    `${packageUrl}?token=private`,
    '/downloads/not-an-installer.exe',
  ])
    expect(
      () =>
        new cacheModule.InstallerDownloadCache(
          { url, size: 8, sha256: 'a'.repeat(64) },
          controller().signal,
        ),
    ).toThrow('invalid_download_url')
  const normalized = new cacheModule.InstallerDownloadCache(
    { url: packageUrl, size: 8, sha256: 'a'.repeat(64) },
    controller().signal,
  )
  sessions.push(normalized)
  expect(normalized.identity.url).toBe(`${location.origin}${packageUrl}`)
  expect(
    () =>
      new cacheModule.InstallerDownloadCache(
        { url: normalized.identity.url, size: 8, sha256: 'a'.repeat(64) },
        controller().signal,
      ),
  ).toThrow('download_in_progress')
})

it('reclaims an abandoned lease immediately after the old document lock has gone, without trusting an active foreign document', async () => {
  const locks = webLocks()
  const abandoned = await open()
  await abandoned.checkpoint(executable(chunkSize))
  // A refresh releases document locks without necessarily delivering abort/unmount.
  locks.endDocument()
  await reload()
  const resumed = await open()
  expect(resumed.bytes).toBe(chunkSize)
  await expect(abandoned.checkpoint(new Uint8Array(8))).rejects.toThrow('download_in_progress')
  await reload()
  await expect(open()).rejects.toThrow('download_in_progress')
  expect(locks.locks.request).toHaveBeenCalledTimes(3)
  expect(await database((db) => db.table('chunks').count())).toBe(1)
})

it('rejects same-module parallel sessions and honors the bounded foreign lease when Web Locks are unavailable', async () => {
  await open()
  await expect(open()).rejects.toThrow('download_in_progress')
  await reload()
  await expect(open()).rejects.toThrow('download_in_progress')
})

it('isolates the same URL by size and SHA and retains at most the two current tool identities', async () => {
  const old = await open()
  await old.checkpoint(executable(chunkSize))
  await old.close()
  const changedSha = await open(chunkSize + 8, 'b'.repeat(64))
  expect(changedSha.bytes).toBe(0)
  await changedSha.checkpoint(executable(chunkSize))
  await changedSha.close()
  const changedSize = await open(chunkSize + 9, 'b'.repeat(64))
  expect(changedSize.bytes).toBe(0)
  await changedSize.close()
  const other = await open(8, 'c'.repeat(64), '/downloads/Soda-Asset-Quick-Read-Setup.exe')
  await other.close()
  expect(await database((db) => db.table('entries').count())).toBe(2)
  expect(await database((db) => db.table('chunks').count())).toBe(0)
})

it('expires checkpoints after twenty-four hours without opening or deleting another database', async () => {
  const unrelated = new Dexie('installer-cache-unrelated-test')
  unrelated.version(1).stores({ facts: 'id' })
  await unrelated.table('facts').put({ id: 'protected', value: 42 })
  const first = await open()
  await first.checkpoint(executable(chunkSize))
  await first.close()
  await reload()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 24 * 60 * 60 * 1000 + 1)
  const expired = await open()
  expect(expired.bytes).toBe(0)
  expect(await unrelated.table('facts').get('protected')).toEqual({ id: 'protected', value: 42 })
  clock.mockRestore()
  unrelated.close()
  await Dexie.delete('installer-cache-unrelated-test')
})

it('does not persist partial chunks or permit a late checkpoint after cancellation', async () => {
  const session = await open()
  await expect(session.checkpoint(new Uint8Array(7))).rejects.toThrow('invalid_download_checkpoint')
  controllers.at(-1)!.abort()
  await expect(session.checkpoint(executable(chunkSize))).rejects.toMatchObject({
    name: 'AbortError',
  })
  expect(await database((db) => db.table('chunks').count())).toBe(0)
})

it('falls back to memory across calls when a completed chunk exceeds quota', async () => {
  const session = await open()
  const original = IDBObjectStore.prototype.put
  const quota = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value: unknown,
    key?: IDBValidKey,
  ) {
    if (this.name === 'chunks') throw new DOMException('quota', 'QuotaExceededError')
    return key === undefined ? original.call(this, value) : original.call(this, value, key)
  })
  await session.checkpoint(executable(chunkSize))
  expect(session.bytes).toBe(chunkSize)
  expect(await database((db) => db.table('chunks').count())).toBe(0)
  await session.close()
  const retry = await open()
  expect(retry.bytes).toBe(chunkSize)
  await retry.checkpoint(new Uint8Array(8))
  expect(retry.bytes).toBe(chunkSize + 8)
  quota.mockRestore()
})

it('bounds a non-settling storage open and ignores its late completion while retaining document mutual exclusion', async () => {
  webLocks()
  let complete!: () => void
  const original = Dexie.prototype.open
  vi.spyOn(Dexie.prototype, 'open').mockImplementationOnce(function (this: Dexie) {
    return new Promise<Dexie>((resolve) => {
      complete = () => {
        void original.call(this).then(resolve)
      }
    }) as ReturnType<Dexie['open']>
  })
  vi.useFakeTimers()
  const opening = open(8)
  await vi.advanceTimersByTimeAsync(2000)
  const session = await opening
  await session.checkpoint(executable(8))
  expect(session.bytes).toBe(8)
  await expect(open(8)).rejects.toThrow('download_in_progress')
  vi.useRealTimers()
  complete()
  await vi.waitFor(async () => expect(await database((db) => db.table('chunks').count())).toBe(0))
})

it('falls back within two seconds when a real IndexedDB upgrade is blocked', async () => {
  webLocks()
  const blocker = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  // A different document can ignore versionchange. It must not freeze the downloader.
  blocker.onversionchange = () => {}
  const opening = open(8)
  const session = await opening
  await session.checkpoint(executable(8))
  expect(session.bytes).toBe(8)
  blocker.close()
  await vi.waitFor(async () => expect(await database((db) => db.table('chunks').count())).toBe(0))
})

it('resumes the actual downloader from IDB after an interrupted transfer and clears checkpoints after requesting save', async () => {
  webLocks()
  const bytes = executable()
  const sha = await digest(bytes)
  const makeResponse = (start: number) => {
    const end = Math.min(bytes.length, start + chunkSize) - 1
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: { etag: `"${sha}"`, 'content-range': `bytes ${start}-${end}/${bytes.length}` },
    })
  }
  const firstFetcher = vi
    .fn()
    .mockResolvedValueOnce(makeResponse(0))
    .mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('fetch', firstFetcher)
  const abort = controller()
  const input = {
    url: packageUrl,
    fileName: 'installer.exe',
    expectedSize: bytes.length,
    expectedSha256: sha,
    onProgress: vi.fn(),
    onSaving: vi.fn(),
  }
  const firstModule = await import('./installerDownload')
  const pending = firstModule.downloadScannerInstaller({ ...input, signal: abort.signal })
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(firstFetcher).toHaveBeenCalledTimes(2))
  abort.abort()
  await rejected
  await reload()
  const nextFetcher = vi.fn().mockResolvedValue(makeResponse(chunkSize))
  vi.stubGlobal('fetch', nextFetcher)
  const nextModule = await import('./installerDownload')
  const onTransfer = vi.fn()
  await expect(
    nextModule.downloadScannerInstaller({ ...input, signal: controller().signal, onTransfer }),
  ).resolves.toBe('save_requested')
  expect(nextFetcher).toHaveBeenCalledOnce()
  expect(nextFetcher.mock.calls[0]![1].headers).toEqual({
    Range: `bytes=${chunkSize}-${bytes.length - 1}`,
    'If-Range': `"${sha}"`,
  })
  expect(onTransfer.mock.calls[0]![0].resumedBytes).toBe(chunkSize)
  expect(createObjectURL.mock.calls[0]![0].size).toBe(bytes.length)
  expect(await database((db) => db.table('entries').count())).toBe(0)
  expect(await database((db) => db.table('chunks').count())).toBe(0)
})

it('discards hash-failed checkpoint bytes and starts the next download cleanly', async () => {
  const bytes = executable(8)
  const sha = await digest(bytes)
  const tampered = bytes.slice()
  tampered[7] ^= 1
  const { downloadScannerInstaller } = await import('./installerDownload')
  const input = {
    url: packageUrl,
    fileName: 'installer.exe',
    expectedSize: bytes.length,
    expectedSha256: sha,
    onProgress: vi.fn(),
    onSaving: vi.fn(),
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(tampered)))
  await expect(downloadScannerInstaller({ ...input, signal: controller().signal })).rejects.toThrow(
    'invalid_download_sha256',
  )
  expect(await database((db) => db.table('chunks').count())).toBe(0)
  const next = vi.fn().mockResolvedValue(new Response(bytes))
  vi.stubGlobal('fetch', next)
  await expect(downloadScannerInstaller({ ...input, signal: controller().signal })).resolves.toBe(
    'save_requested',
  )
  expect(next).toHaveBeenCalledOnce()
})
