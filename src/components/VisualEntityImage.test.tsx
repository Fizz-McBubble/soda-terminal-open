import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VisualEntityImage } from './VisualEntityImage'
import { getVisualAsset, officialAgentFullBodyAssets } from '../assets/visualAssets'
import {
  createLatestVisualSelection,
  preloadVisualEntityImage,
  sessionVisualSources,
  resolveVisualEntityImageAsset,
} from '../assets/visualEntityImageSource'

// Model verified cache bytes at the digest boundary; consumers still execute the
// production hash comparison before any blob/decode/display operation.
function verifiedResponse(entityType: 'agent' | 'wengine', entityId: string) {
  return new Response(getVisualAsset(entityType, entityId)!.contentHash)
}

describe('VisualEntityImage', () => {
  beforeEach(() => {
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (_algorithm, bytes) => {
      const hash = new TextDecoder().decode(bytes as ArrayBuffer)
      if (!/^sha256-[a-f0-9]{64}$/.test(hash)) throw new Error('unverified test cache bytes')
      return Uint8Array.from(hash.slice(7).match(/.{2}/g)!, (part) => parseInt(part, 16)).buffer
    })
  })
  it('uses the shared catalog for legacy full-body requests without bundling audit artwork', () => {
    const image = resolveVisualEntityImageAsset({
      entityType: 'agent',
      entityId: 'agent-remielle',
      variant: 'full_body',
    })
    expect(image.asset?.variant).toBe('full_body')
    expect(image.asset?.remoteUrl).toMatch(/^https:\/\//)
    expect(image.bundledSource).toBeNull()
  })
  it('uses catalog originals and identical hero geometry for every agent, including legacy cutouts', () => {
    expect(officialAgentFullBodyAssets.some((asset) => asset.entityId === 'agent-remielle')).toBe(
      true,
    )
    const heroes = officialAgentFullBodyAssets.map(({ entityId }) =>
      resolveVisualEntityImageAsset({
        entityType: 'agent',
        entityId,
        slotId: 'agent.hero',
        consumer: 'agent-development.workbench',
      }),
    )
    for (const hero of heroes) {
      expect(hero.asset?.variant).toBe('full_body')
      expect(hero.bundledSource).toBeNull()
      expect(hero.slot).toEqual(heroes[0].slot)
    }
  })
  afterEach(() => {
    localStorage.clear()
    sessionVisualSources.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it('uses a readable text fallback when an auditable asset is unavailable', () => {
    render(
      <VisualEntityImage entityType="agent" entityId="agent-not-in-manifest" name="未收录代理人" />,
    )

    const fallback = screen.getByRole('img', { name: '未收录代理人，此图暂缺' })
    expect(fallback).toHaveTextContent('未收录代理人')
    expect(fallback).toHaveTextContent('此图暂缺')
    expect(fallback).toHaveAttribute('data-visual-state', 'source-missing')
  })

  it('keeps a missing small portrait compact without losing its accessible description', () => {
    render(
      <VisualEntityImage
        entityType="agent"
        entityId="unknown-agent"
        name="测试角色"
        compactFallback
      />,
    )
    const fallback = screen.getByRole('img', { name: '测试角色，此图暂缺' })
    expect(fallback).toHaveClass('is-compact')
    expect(fallback).toBeEmptyDOMElement()
    expect(fallback).toHaveAttribute('data-visual-state', 'source-missing')
  })

  it('does not hotlink an official catalog image before the personal cache has verified it', async () => {
    render(<VisualEntityImage entityType="wengine" entityId="wengine-12001" name="「月相」-望" />)

    const loading = screen.getByRole('img', { name: '「月相」-望，图片加载中' })
    expect(loading).toHaveAttribute('aria-busy', 'true')
    expect(loading).toHaveAttribute('data-visual-state', 'loading')
    await waitFor(() =>
      expect(screen.getByRole('img', { name: '「月相」-望，图片未加载' })).toHaveAttribute(
        'data-visual-state',
        'cache-missing',
      ),
    )
    expect(screen.queryByRole('img', { name: '「月相」-望图鉴图像' })).not.toBeInTheDocument()
  })

  it('does not hotlink a reference-only catalog image before its personal cache is ready', async () => {
    render(<VisualEntityImage entityType="wengine" entityId="wengine-14159" name="骁骑礼赞" />)

    await waitFor(() =>
      expect(screen.getByRole('img', { name: '骁骑礼赞，图片未加载' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('img', { name: '骁骑礼赞图鉴图像' })).not.toBeInTheDocument()
  })

  it('rejects cache bytes whose digest does not match the selected manifest asset before display', async () => {
    const createObjectURL = vi.fn(() => 'blob:wrong-asset')
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({ match: async () => verifiedResponse('agent', 'agent-anby') })),
    })
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    localStorage.setItem(
      'soda-terminal:visual-assets:state:v1',
      JSON.stringify({ activeCaches: { wengine: 'isolated-corrupt-cache' } }),
    )
    render(<VisualEntityImage entityType="wengine" entityId="wengine-12001" name="「月相」-望" />)
    expect(await screen.findByRole('img', { name: '「月相」-望，图片未加载' })).toHaveAttribute(
      'data-visual-state',
      'cache-missing',
    )
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.queryByRole('img', { name: '「月相」-望图鉴图像' })).not.toBeInTheDocument()
  })

  it('renders a verified W-engine image from the activated local cache without a remote hotlink', async () => {
    const assetUrl = 'https://webstatic.mihoyo.com/asset.jpg'
    const open = vi.fn(async () => ({
      match: async () => verifiedResponse('wengine', 'wengine-12001'),
    }))
    const createObjectURL = vi.fn(() => 'blob:official-wengine')
    vi.stubGlobal('caches', { open })
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    localStorage.setItem(
      'soda-terminal:visual-assets:state:v1',
      JSON.stringify({
        activeCache: null,
        previousCache: null,
        installedAt: null,
        packVersion: null,
        wEngineCache: 'official-wengine-cache',
        previousWEngineCache: null,
        wEngineInstalledAt: '2026-07-15T00:00:00.000Z',
        wEnginePackVersion: 'v1',
      }),
    )

    render(<VisualEntityImage entityType="wengine" entityId="wengine-12001" name="「月相」-望" />)

    expect(screen.getByRole('img', { name: '「月相」-望，图片加载中' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(screen.queryByRole('img', { name: '「月相」-望，图片未加载' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('img', { name: '「月相」-望图鉴图像' })).toHaveAttribute(
        'src',
        'blob:official-wengine',
      ),
    )
    expect(open).toHaveBeenCalledWith('official-wengine-cache')
    expect(createObjectURL).toHaveBeenCalled()
    expect(screen.queryByText(assetUrl)).not.toBeInTheDocument()
  })

  it('renders the verified square-avatar original rather than a display derivative', async () => {
    const match = vi.fn(async () => {
      return verifiedResponse('agent', 'agent-alice')
    })
    const open = vi.fn(async () => ({ match }))
    const createObjectURL = vi.fn(() => 'blob:original-avatar')
    vi.stubGlobal('caches', { open })
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    localStorage.setItem(
      'soda-terminal:visual-assets:state:v1',
      JSON.stringify({ activeCaches: { agent: 'official-agent-cache' } }),
    )

    render(<VisualEntityImage entityType="agent" entityId="agent-alice" name="爱丽丝" />)

    await waitFor(() =>
      expect(screen.getByRole('img', { name: '爱丽丝图鉴图像' })).toHaveAttribute(
        'src',
        'blob:original-avatar',
      ),
    )
    expect(match).toHaveBeenCalledWith(expect.not.stringContaining('soda-display='))
    expect(match).toHaveBeenCalledTimes(1)
  })

  it('remounts a detail avatar when selection changes and clears the prior image failure', async () => {
    const match = vi.fn(async (request: RequestInfo | URL) =>
      verifiedResponse(
        'agent',
        String(request).includes('IconRoleCrop65') ? 'agent-norma' : 'agent-remielle',
      ),
    )
    const open = vi.fn(async () => ({ match }))
    const createObjectURL = vi.fn(() => 'blob:shared-test-url')
    vi.stubGlobal('caches', { open })
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    localStorage.setItem(
      'soda-terminal:visual-assets:state:v1',
      JSON.stringify({ activeCaches: { agent: 'official-agent-cache' } }),
    )

    const { rerender } = render(
      <VisualEntityImage
        entityType="agent"
        entityId="agent-remielle"
        name="蕾米埃尔·丹"
        slotId="agent.square-avatar"
        consumer="assets.editor"
      />,
    )
    const firstImage = await screen.findByRole('img', { name: '蕾米埃尔·丹图鉴图像' })
    fireEvent.error(firstImage)
    expect(screen.getByRole('img', { name: '蕾米埃尔·丹，图片加载失败' })).toHaveAttribute(
      'data-visual-state',
      'error',
    )

    rerender(
      <VisualEntityImage
        entityType="agent"
        entityId="agent-norma"
        name="诺姆"
        slotId="agent.square-avatar"
        consumer="assets.editor"
      />,
    )

    expect(await screen.findByRole('img', { name: '诺姆图鉴图像' })).toHaveAttribute(
      'src',
      'blob:shared-test-url',
    )
    expect(screen.queryByRole('img', { name: '蕾米埃尔·丹图鉴图像' })).not.toBeInTheDocument()
  })

  it('shares a preloaded detail avatar with the component that mounts after selection', async () => {
    const open = vi.fn(async () => ({
      match: async () => verifiedResponse('agent', 'agent-anton'),
    }))
    const createObjectURL = vi.fn(() => 'blob:preloaded-avatar')
    vi.stubGlobal('caches', { open })
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    localStorage.setItem(
      'soda-terminal:visual-assets:state:v1',
      JSON.stringify({ activeCaches: { agent: 'official-agent-cache' } }),
    )

    await preloadVisualEntityImage({
      entityType: 'agent',
      entityId: 'agent-anton',
      slotId: 'agent.square-avatar',
      consumer: 'box.team-overview',
    })

    render(
      <VisualEntityImage
        entityType="agent"
        entityId="agent-anton"
        name="安东"
        slotId="agent.square-avatar"
        consumer="box.team-overview"
      />,
    )

    expect(await screen.findByRole('img', { name: '安东图鉴图像' })).toHaveAttribute(
      'src',
      'blob:preloaded-avatar',
    )
    expect(open).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('does not publish a detail avatar until the browser has decoded it', async () => {
    const open = vi.fn(async () => ({
      match: async () => verifiedResponse('agent', 'agent-alice'),
    }))
    let finishDecode: (() => void) | undefined
    const decode = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishDecode = resolve
        }),
    )
    vi.stubGlobal(
      'Image',
      class {
        src = ''
        decode = decode
      },
    )
    vi.stubGlobal('caches', { open })
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:decoded-avatar') })
    localStorage.setItem(
      'soda-terminal:visual-assets:state:v1',
      JSON.stringify({ activeCaches: { agent: 'official-agent-cache' } }),
    )

    const preparation = preloadVisualEntityImage({
      entityType: 'agent',
      entityId: 'agent-alice',
      slotId: 'agent.square-avatar',
      consumer: 'assets.editor',
    })
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(1))
    expect(sessionVisualSources.size).toBe(0)

    finishDecode?.()
    await expect(preparation).resolves.toBe('blob:decoded-avatar')
    expect([...sessionVisualSources.values()]).toEqual(['blob:decoded-avatar'])
    expect(open).toHaveBeenCalledWith('official-agent-cache')
  })

  it('commits only the newest detail selection after its image becomes ready', async () => {
    const releases = new Map<string, () => void>()
    const prepare = vi.fn(
      (request: { entityId: string }) =>
        new Promise<string | null>((resolve) => {
          releases.set(request.entityId, () => resolve(`blob:${request.entityId}`))
        }),
    )
    const select = createLatestVisualSelection(prepare)
    const commits: string[] = []
    const remielle = {
      entityType: 'agent' as const,
      entityId: 'agent-remielle',
      slotId: 'agent.square-avatar' as const,
      consumer: 'assets.editor' as const,
    }
    const norma = { ...remielle, entityId: 'agent-norma' }

    const first = select(remielle, () => commits.push('蕾米埃尔·丹'))
    const second = select(norma, () => commits.push('诺姆'))
    releases.get('agent-remielle')?.()
    await first
    expect(commits).toEqual([])

    releases.get('agent-norma')?.()
    await second
    expect(commits).toEqual(['诺姆'])
    expect(prepare).toHaveBeenCalledTimes(2)
  })

  it('keeps a previously activated agent image visible after a separate W-engine cache is active', async () => {
    const open = vi.fn(async () => ({ match: async () => verifiedResponse('agent', 'agent-anby') }))
    vi.stubGlobal('caches', { open })
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:official-agent'),
      revokeObjectURL: vi.fn(),
    })
    localStorage.setItem(
      'soda-terminal:visual-assets:state:v1',
      JSON.stringify({
        activeCache: null,
        previousCache: null,
        installedAt: null,
        packVersion: null,
        wEngineCache: 'official-wengine-cache',
        previousWEngineCache: null,
        wEngineInstalledAt: null,
        wEnginePackVersion: 'v1',
        activeCaches: { agent: 'official-agent-cache', wengine: 'official-wengine-cache' },
        previousCaches: {},
      }),
    )

    render(<VisualEntityImage entityType="agent" entityId="agent-anby" name="安比" />)

    await waitFor(() =>
      expect(screen.getByRole('img', { name: '安比图鉴图像' })).toHaveAttribute(
        'src',
        'blob:official-agent',
      ),
    )
    expect(open).toHaveBeenCalledWith('official-agent-cache')
  })

  it('executes the approved slot presentation and consumer-specific compact minimum', async () => {
    const open = vi.fn(async () => ({ match: async () => verifiedResponse('agent', 'agent-anby') }))
    vi.stubGlobal('caches', { open })
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:slot-agent'),
      revokeObjectURL: vi.fn(),
    })
    localStorage.setItem(
      'soda-terminal:visual-assets:state:v1',
      JSON.stringify({
        activeCaches: { agent: 'official-agent-cache' },
        previousCaches: {},
      }),
    )

    const view = render(
      <VisualEntityImage
        entityType="agent"
        entityId="agent-anby"
        name="安比"
        slotId="agent.square-avatar"
        consumer="box.team-overview"
      />,
    )

    const image = await screen.findByRole('img', { name: '安比图鉴图像' })
    expect(image).toHaveAttribute('data-visual-slot', 'agent.square-avatar')
    expect(image).toHaveAttribute('data-visual-variant', 'square_avatar')
    expect(image).toHaveAttribute('data-visual-state', 'available')
    expect(image).toHaveAttribute('data-visual-slot-minimum', '36x36')
    expect(image).toHaveStyle({
      aspectRatio: '1 / 1',
      objectFit: 'cover',
      objectPosition: 'center',
    })

    view.rerender(
      <VisualEntityImage
        entityType="agent"
        entityId="agent-anby"
        name="安比"
        slotId="agent.factual-card"
        consumer="agent-development.overview"
      />,
    )
    expect(view.container.querySelector('[data-visual-slot="agent.factual-card"]')).toHaveAttribute(
      'data-visual-slot-minimum',
      '76x72',
    )

    view.rerender(
      <VisualEntityImage
        entityType="agent"
        entityId="agent-anby"
        name="安比"
        slotId="agent.factual-card"
        consumer="assets.catalog"
      />,
    )
    expect(view.container.querySelector('[data-visual-slot="agent.factual-card"]')).toHaveAttribute(
      'data-visual-slot-minimum',
      '104x84',
    )
  })
})
