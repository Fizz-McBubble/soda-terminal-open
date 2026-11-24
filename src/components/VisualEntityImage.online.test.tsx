import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stateStorageKey } from '../assets/visualAssetBrowserRuntime'
import {
  enableVisibleCatalogDownloads,
  loadVisibleCatalogImage,
  stopVisibleCatalogDownloads,
} from '../assets/visibleCatalogDownload'
import {
  getVisualAsset,
  synchronizeVisualAssetPack,
  visualAssetManifest,
} from '../assets/visualAssets'
import { invalidateSessionVisualSources } from '../assets/visualEntityImageSource'
import { VisualEntityImage } from './VisualEntityImage'

const anby = getVisualAsset('agent', 'agent-anby')!
const singleImageManifest = { ...visualAssetManifest, assets: [anby] }

describe('online catalog images', () => {
  const contents = new Map<string, Response>()
  const fetcher = vi.fn<typeof fetch>()
  const persist = (key: RequestInfo | URL, response: Response) => {
    contents.set(String(key), response)
    return Promise.resolve()
  }
  const put = vi.fn(persist)
  const cache = {
    match: async (key: RequestInfo | URL) => contents.get(String(key))?.clone(),
    put,
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('caches', { open: async () => cache })
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (_algorithm, bytes) => {
      const source = new TextDecoder().decode(bytes as ArrayBuffer)
      return Uint8Array.from(
        (source === 'verified' ? anby.contentHash.slice(7) : '0'.repeat(64)).match(/../g)!,
        (hex) => parseInt(hex, 16),
      ).buffer
    })
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:verified-anby')
        static revokeObjectURL = vi.fn()
      },
    )
    contents.clear()
    fetcher.mockReset()
    put.mockReset().mockImplementation(persist)
    enableVisibleCatalogDownloads()
  })
  afterEach(() => {
    stopVisibleCatalogDownloads()
    invalidateSessionVisualSources()
    localStorage.removeItem(stateStorageKey)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders before the shared cache write settles, then reopens offline without another request', async () => {
    fetcher.mockResolvedValue(new Response('verified'))
    let finishWrite!: () => void
    put.mockImplementationOnce(
      (key, response) =>
        new Promise<void>((resolve) => {
          finishWrite = () => {
            void persist(key, response)
            resolve()
          }
        }),
    )
    const renderAvatar = () => (
      <VisualEntityImage entityType="agent" entityId="agent-anby" name="安比" />
    )
    const view = render(
      <>
        {renderAvatar()}
        {renderAvatar()}
      </>,
    )
    expect(await screen.findAllByRole('img', { name: '安比图鉴图像' })).toHaveLength(2)
    expect(contents.size).toBe(0)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0][0]).toMatch(/^\/official-catalog-cache\?source=/)

    const background = synchronizeVisualAssetPack(singleImageManifest)
    finishWrite()
    await expect(background).resolves.toMatchObject({ installed: 1, failed: 0 })
    expect(put).toHaveBeenCalledOnce()
    view.unmount()
    invalidateSessionVisualSources()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(renderAvatar())
    expect(await screen.findByRole('img', { name: '安比图鉴图像' })).toHaveAttribute(
      'src',
      'blob:verified-anby',
    )
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('shares a background request already in flight with a visible image', async () => {
    let finishRequest!: (response: Response) => void
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve
        }),
    )
    const background = synchronizeVisualAssetPack(singleImageManifest)
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    const visible = loadVisibleCatalogImage(anby)
    finishRequest(new Response('verified'))
    await expect(visible).resolves.toBeInstanceOf(Blob)
    await expect(background).resolves.toMatchObject({ installed: 1, failed: 0 })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(put).toHaveBeenCalledOnce()
  })

  it('discards invalid bytes and suppresses a request that completes after cancellation', async () => {
    fetcher.mockResolvedValueOnce(new Response('corrupt'))
    await expect(loadVisibleCatalogImage(anby)).rejects.toThrow('内容哈希不一致')
    expect(put).not.toHaveBeenCalled()

    let finishRequest!: (response: Response) => void
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve
        }),
    )
    const visible = loadVisibleCatalogImage(anby)
    const cancelled = expect(visible).rejects.toMatchObject({ name: 'AbortError' })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    stopVisibleCatalogDownloads()
    finishRequest(new Response('verified'))
    await cancelled
    expect(put).not.toHaveBeenCalled()
    await expect(loadVisibleCatalogImage(anby)).resolves.toBeNull()
  })
})
