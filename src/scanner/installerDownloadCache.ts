import Dexie, { type Table } from 'dexie'

export const installerDownloadChunkSize = 4 * 1024 * 1024
export const installerDownloadCacheDatabaseName = 'soda-installer-download-cache-v1'
const retentionMs = 24 * 60 * 60 * 1000
const leaseMs = 120_000

export type InstallerCacheIdentity = { url: string; size: number; sha256: string }
type Checkpoint = InstallerCacheIdentity & {
  key: string
  bytes: number
  updatedAt: number
  owner: string | null
  leaseUntil: number
}
type Chunk = { key: string; index: number; data: Uint8Array<ArrayBuffer> }
type MemoryCheckpoint = {
  identity: InstallerCacheIdentity
  chunks: Uint8Array<ArrayBuffer>[]
  updatedAt: number
}

class DownloadCacheDatabase extends Dexie {
  entries!: Table<Checkpoint, string>
  chunks!: Table<Chunk, [string, number]>
  constructor() {
    super(installerDownloadCacheDatabaseName)
    this.version(1).stores({ entries: 'key,url', chunks: '[key+index],key' })
  }
}

const memory = new Map<string, MemoryCheckpoint>()
const activeUrls = new Set<string>()
let ownerSequence = 0
const cacheKey = (identity: InstallerCacheIdentity) =>
  `${identity.url}|${identity.size}|${identity.sha256}`

/** This cache accepts only the two public same-origin aliases, never signed URLs. */
export function installerDownloadIdentity(
  url: string,
  size: number,
  sha256: string,
): InstallerCacheIdentity {
  const parsed = new URL(url, location.href)
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.origin !== location.origin ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !['/downloads/Soda-Scanner-Setup.exe', '/downloads/Soda-Asset-Quick-Read-Setup.exe'].includes(
      parsed.pathname,
    )
  )
    throw new Error('invalid_download_url')
  return { url: parsed.href, size, sha256 }
}

function busy(): never {
  throw new Error('download_in_progress')
}
function storageWait<T>(promise: PromiseLike<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      finish()
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      finish()
      reject(new Error('download_storage_timeout'))
    }, 2000)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    promise.then(
      (value) => {
        finish()
        resolve(value)
      },
      (error: unknown) => {
        finish()
        reject(error)
      },
    )
  })
}
function validChunks(chunks: Uint8Array<ArrayBuffer>[], size: number) {
  let bytes = 0
  for (const chunk of chunks) {
    if (
      !ArrayBuffer.isView(chunk) ||
      Object.prototype.toString.call(chunk) !== '[object Uint8Array]' ||
      chunk.byteLength !== Math.min(installerDownloadChunkSize, size - bytes)
    )
      return false
    bytes += chunk.byteLength
  }
  return bytes <= size
}

/** Independent public-package storage. No account database, cookies, or credentials. */
export class InstallerDownloadCache {
  readonly identity: InstallerCacheIdentity
  private readonly signal: AbortSignal
  readonly key: string
  chunks: Uint8Array<ArrayBuffer>[] = []
  private db: DownloadCacheDatabase | undefined
  private persistent = false
  private storageDisabled = false
  private documentLock = false
  private unlockDocument: (() => void) | undefined
  private closed = false
  private closing: Promise<void> | undefined
  private heartbeat: ReturnType<typeof setInterval> | undefined
  private readonly owner = `${Date.now()}:${++ownerSequence}:${Math.random()}`
  private readonly abort = () => {
    void this.close()
  }

  constructor(identity: InstallerCacheIdentity, signal: AbortSignal) {
    const normalized = installerDownloadIdentity(identity.url, identity.size, identity.sha256)
    this.identity = normalized
    this.signal = signal
    this.key = cacheKey(normalized)
    if (activeUrls.has(normalized.url)) busy()
    activeUrls.add(normalized.url)
    signal.addEventListener('abort', this.abort, { once: true })
  }

  get bytes() {
    return this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  }

  private remember() {
    memory.set(this.key, {
      identity: this.identity,
      chunks: [...this.chunks],
      updatedAt: Date.now(),
    })
  }

  private guardStorage() {
    this.signal.throwIfAborted()
    if (this.closed || this.storageDisabled) throw new Error('download_storage_inactive')
  }

  private async lockDocument() {
    const locks = navigator.locks
    if (!locks?.request) return
    let active = true
    try {
      await storageWait(
        new Promise<void>((resolve, reject) => {
          void locks
            .request(
              `soda-installer:${this.identity.url}`,
              { mode: 'exclusive', ifAvailable: true },
              async (lock) => {
                if (!active || this.closed) return
                if (!lock) {
                  reject(new Error('download_in_progress'))
                  return
                }
                this.documentLock = true
                await new Promise<void>((release) => {
                  this.unlockDocument = release
                  resolve()
                })
              },
            )
            .catch(reject)
        }),
        this.signal,
      )
    } finally {
      active = false
    }
  }

  async open() {
    try {
      await this.lockDocument()
    } catch (error) {
      void this.close()
      throw error
    }
    for (const [key, entry] of memory)
      if (
        Date.now() - entry.updatedAt >= retentionMs ||
        (entry.identity.url === this.identity.url && key !== this.key)
      )
        memory.delete(key)
    const previous = memory.get(this.key)
    if (previous && validChunks(previous.chunks, this.identity.size))
      this.chunks = [...previous.chunks]
    const db = new DownloadCacheDatabase()
    this.db = db
    try {
      const opening = db.open()
      void opening.then(
        () => {
          if (this.storageDisabled || this.closed) db.close()
        },
        () => {},
      )
      await storageWait(opening, this.signal)
      this.guardStorage()
      await storageWait(
        db.transaction('rw', db.entries, db.chunks, async () => {
          const entries = await db.entries.toArray()
          this.guardStorage()
          for (const entry of entries) {
            if (
              !this.documentLock &&
              entry.url === this.identity.url &&
              entry.owner &&
              entry.leaseUntil > Date.now()
            )
              busy()
            if (
              Date.now() - entry.updatedAt >= retentionMs ||
              (entry.url === this.identity.url && entry.key !== this.key)
            ) {
              await db.chunks.where('key').equals(entry.key).delete()
              await db.entries.delete(entry.key)
            }
          }
          const saved = await db.entries.get(this.key)
          const rows = saved ? await db.chunks.where('key').equals(this.key).sortBy('index') : []
          this.guardStorage()
          const stored = rows.map((row) => row.data)
          if (
            saved &&
            rows.every((row, index) => row.index === index) &&
            validChunks(stored, this.identity.size) &&
            saved.url === this.identity.url &&
            saved.size === this.identity.size &&
            saved.sha256 === this.identity.sha256 &&
            saved.bytes === stored.reduce((sum, chunk) => sum + chunk.byteLength, 0) &&
            saved.bytes > this.bytes
          )
            this.chunks = stored.map((chunk) => new Uint8Array(chunk))
          // Repair an incomplete/expired record atomically, or persist a memory-only retry.
          await db.chunks.where('key').equals(this.key).delete()
          if (this.chunks.length)
            await db.chunks.bulkPut(
              this.chunks.map((data, index) => ({ key: this.key, index, data })),
            )
          this.guardStorage()
          await db.entries.put(this.record())
        }),
        this.signal,
      )
      this.persistent = true
      this.heartbeat = setInterval(() => {
        void this.renew().catch(() => this.disablePersistence())
      }, 30_000)
    } catch (error) {
      if (
        this.signal.aborted ||
        (error instanceof Error && error.message === 'download_in_progress')
      ) {
        void this.close()
        throw error
      }
      this.disablePersistence()
    }
    this.remember()
    return this
  }

  private record(): Checkpoint {
    return {
      ...this.identity,
      key: this.key,
      bytes: this.bytes,
      updatedAt: Date.now(),
      owner: this.owner,
      leaseUntil: Date.now() + leaseMs,
    }
  }

  private async renew() {
    const db = this.db
    if (!this.persistent || !db || this.closed) return
    await storageWait(
      db.transaction('rw', db.entries, async () => {
        const entry = await db.entries.get(this.key)
        if (entry?.owner !== this.owner) busy()
        if (!this.closed) await db.entries.put({ ...entry, leaseUntil: Date.now() + leaseMs })
      }),
    )
  }

  private async release() {
    const db = this.db
    if (!db?.isOpen()) return
    try {
      await storageWait(
        db.transaction('rw', db.entries, async () => {
          const entry = await db.entries.get(this.key)
          if (entry?.owner === this.owner)
            await db.entries.put({ ...entry, owner: null, leaseUntil: 0 })
        }),
      )
    } catch {
      /* Storage may be unavailable; a crashed session's lease is bounded. */
    }
  }

  private disablePersistence() {
    this.persistent = false
    this.storageDisabled = true
    clearInterval(this.heartbeat)
    void this.release()
  }

  async checkpoint(chunk: Uint8Array<ArrayBuffer>) {
    this.signal.throwIfAborted()
    if (this.closed) throw new Error('download_cache_closed')
    if (chunk.byteLength !== Math.min(installerDownloadChunkSize, this.identity.size - this.bytes))
      throw new Error('invalid_download_checkpoint')
    const before = this.bytes
    const index = this.chunks.length
    this.chunks.push(chunk)
    this.remember()
    const db = this.db
    if (!this.persistent || !db) return
    try {
      await storageWait(
        db.transaction('rw', db.entries, db.chunks, async () => {
          const entry = await db.entries.get(this.key)
          if (
            entry?.owner !== this.owner ||
            entry.bytes !== before ||
            entry.sha256 !== this.identity.sha256
          )
            busy()
          this.guardStorage()
          await db.chunks.put({ key: this.key, index, data: chunk })
          await db.entries.put(this.record())
        }),
        this.signal,
      )
    } catch (error) {
      if (
        this.signal.aborted ||
        (error instanceof Error && error.message === 'download_in_progress')
      )
        throw error
      this.disablePersistence()
    }
  }

  async discard() {
    memory.delete(this.key)
    this.chunks = []
    const db = this.db
    if (!db?.isOpen() || this.closed) return
    try {
      await storageWait(
        db.transaction('rw', db.entries, db.chunks, async () => {
          const entry = await db.entries.get(this.key)
          if (entry?.owner && entry.owner !== this.owner) return
          await db.chunks.where('key').equals(this.key).delete()
          await db.entries.delete(this.key)
        }),
      )
    } catch {
      /* A failed storage backend must not prevent cancellation or a retry. */
    }
  }

  async reset() {
    this.signal.throwIfAborted()
    this.chunks = []
    this.remember()
    const db = this.db
    if (!this.persistent || !db || this.closed) return
    try {
      await storageWait(
        db.transaction('rw', db.entries, db.chunks, async () => {
          const entry = await db.entries.get(this.key)
          if (entry?.owner !== this.owner) busy()
          this.guardStorage()
          await db.chunks.where('key').equals(this.key).delete()
          await db.entries.put(this.record())
        }),
        this.signal,
      )
    } catch (error) {
      if (error instanceof Error && error.message === 'download_in_progress') throw error
      this.disablePersistence()
    }
  }

  close(): Promise<void> {
    if (this.closing) return this.closing
    this.closed = true
    this.unlockDocument?.()
    clearInterval(this.heartbeat)
    activeUrls.delete(this.identity.url)
    this.signal.removeEventListener('abort', this.abort)
    this.closing = this.release().finally(() => this.db?.close())
    return this.closing
  }
}
