import { expect, it } from 'vitest'
import displayProjection from './visual-assets-display.v1.json'
import { preloadVisualEntityImage, resolveVisualEntityImageAsset } from './visualEntityImageSource'
import { getVisualAsset } from './visualAssets'

it.skipIf(import.meta.env.VITE_SODA_PUBLIC_BUILD !== 'true')(
  'keeps the image pipeline available in the public build',
  async () => {
    const asset = getVisualAsset('agent', 'agent-anby')
    expect(asset?.remoteUrl).toBeTruthy()
    expect(asset?.contentHash).toMatch(/^sha256-[a-f0-9]{64}$/)
    expect(
      resolveVisualEntityImageAsset({ entityType: 'agent', entityId: 'agent-anby' }).asset
        ?.entityId,
    ).toBe('agent-anby')
    // The public build resolves images through the same load/cache/preload pipeline.
    await expect(
      preloadVisualEntityImage({ entityType: 'agent', entityId: 'agent-anby' }),
    ).resolves.toBeDefined()
  },
)

it('ships only display and cache facts in the generated public projection', () => {
  expect(displayProjection.assets.length).toBeGreaterThan(0)
  const fields = Object.keys(displayProjection.assets[0]!)
  for (const internal of ['license', 'sourcePage', 'attribution', 'verifiedAt', 'localCache'])
    expect(fields, `public projection must not carry ${internal}`).not.toContain(internal)
  expect('sourcePages' in displayProjection).toBe(false)
  expect('attribution' in displayProjection).toBe(false)
  // Remote URLs are carried as-is (some bundled-original entries have none).
  expect(displayProjection.assets.some((asset) => Boolean(asset.remoteUrl))).toBe(true)
})
