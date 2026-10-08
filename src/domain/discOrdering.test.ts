import { describe, expect, it } from 'vitest'
import { compareDiscGameOrder, type DiscOrderKey } from './discOrdering'

const hash = 'a'.repeat(64)
const scanned = (
  id: string,
  sequence: number,
  patch: Partial<DiscOrderKey> = {},
): DiscOrderKey => ({
  id,
  setId: 'set-a',
  slot: 1,
  mainStat: 'hp_flat',
  level: 15,
  importBatchId: 'scan-latest',
  importSource: {
    adapter: 'soda-terminal-scan-staging',
    sourceId: `sha256:${hash}:${String(sequence).padStart(4, '0')}`,
    capturedAt: '2026-10-08T13:07:45.000Z',
  },
  ...patch,
})

describe('captured game disc order', () => {
  it('keeps the captured order despite ids, level and stat ties, without mutating records', () => {
    const input = [scanned('id-a', 10), scanned('id-z', 2, { level: 0 }), scanned('id-m', 1)]
    const before = structuredClone(input)
    expect([...input].sort(compareDiscGameOrder).map((disc) => disc.id)).toEqual([
      'id-m',
      'id-z',
      'id-a',
    ])
    expect(input).toEqual(before)
  })

  it('keeps independent batches together and puts the newest complete capture first', () => {
    const older = scanned('older', 1, {
      importBatchId: 'older',
      importSource: {
        adapter: 'soda-terminal-scan-staging',
        sourceId: `sha256:${hash}:0001`,
        capturedAt: '2026-10-07T00:00:00.000Z',
      },
    })
    const known = [scanned('second', 2), older, scanned('first', 1)]
    const legacy = scanned('legacy', 1, { importSource: undefined })
    const input = [older, legacy, ...known.slice(0, 1), known[2]!]
    expect([...input].sort(compareDiscGameOrder).map((disc) => disc.id)).toEqual([
      'first',
      'second',
      'older',
      'legacy',
    ])
    expect([...input].reverse().sort(compareDiscGameOrder)).toEqual(
      [...input].sort(compareDiscGameOrder),
    )
  })

  it.each([
    { importSource: { adapter: 'external', sourceId: `sha256:${hash}:0001` } },
    { importSource: { adapter: 'soda-terminal-scan-staging', sourceId: 'external:0001' } },
    { importSource: { adapter: 'soda-terminal-scan-staging', sourceId: `sha256:${hash}:0000` } },
    {
      importSource: {
        adapter: 'soda-terminal-scan-staging',
        sourceId: `sha256:${hash}:9007199254740992`,
      },
    },
    { importBatchId: undefined },
  ])('does not treat unsupported source metadata as game position: %j', (patch) => {
    const unsupported = scanned('unknown', 1, { level: 15, ...patch })
    const known = scanned('known', 9, { level: 0 })
    expect([unsupported, known].sort(compareDiscGameOrder)[0]).toBe(known)
  })

  it('uses level then catalog order for records that have no captured sequence', () => {
    const low = scanned('low', 1, { importSource: undefined, level: 0 })
    const high = scanned('high', 2, { importSource: undefined, level: 15 })
    expect([low, high].sort(compareDiscGameOrder)).toEqual([high, low])
  })
})
