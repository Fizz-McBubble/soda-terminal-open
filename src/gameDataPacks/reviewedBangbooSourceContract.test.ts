import { beforeEach, describe, expect, it, vi } from 'vitest'
import { current31ReviewedBangbooSourceAtoms } from './generated/current31-reviewed-bangboo-source-atoms'
import { isReviewedSourceAtomContractValid } from './reviewedBangbooSourceContract'

vi.mock('./generated/current31-reviewed-bangboo-source-atoms', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./generated/current31-reviewed-bangboo-source-atoms')>()
  return {
    ...original,
    current31ReviewedBangbooSourceAtoms: structuredClone(
      original.current31ReviewedBangbooSourceAtoms,
    ),
  }
})

const original = structuredClone(current31ReviewedBangbooSourceAtoms)
const mutable = current31ReviewedBangbooSourceAtoms as unknown as {
  runtimeContentHash: string
  sourceCensus: { path: string; sha256: string }
  atoms: { lineup: string[] }[]
}
const censusReference = 'soda-source-ref:db1f4aee049727cb508b6cba3a4a9e46'

beforeEach(() => Object.assign(current31ReviewedBangbooSourceAtoms, structuredClone(original)))

describe('reviewed source integrity across the private and community builds', () => {
  it('retains the private canonical contract', () => {
    expect(isReviewedSourceAtomContractValid()).toBe(true)
  })

  it('accepts the exact reviewed locator projection without dropping source lineups', () => {
    mutable.sourceCensus.path = censusReference
    expect(isReviewedSourceAtomContractValid()).toBe(true)
    expect(mutable.atoms.some((row) => row.lineup.includes('agent-anby'))).toBe(true)
  })

  it.each(['lineup', 'source_hash', 'locator', 'runtime_hash'])(
    'rejects projected %s drift',
    (field) => {
      mutable.sourceCensus.path = censusReference
      if (field === 'lineup') mutable.atoms[0]!.lineup[3] = 'bangboo-robin'
      if (field === 'source_hash') mutable.sourceCensus.sha256 = 'changed'
      if (field === 'locator') mutable.sourceCensus.path = 'soda-source-ref:unknown'
      if (field === 'runtime_hash') mutable.runtimeContentHash = 'fnv1a-unknown'
      expect(isReviewedSourceAtomContractValid()).toBe(false)
    },
  )
})
