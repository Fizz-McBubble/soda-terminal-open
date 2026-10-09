import { describe, expect, it } from 'vitest'
import { legalTeamDisc } from '../decision/teamDynamicIntegration.testFixture'
import { currentDriveDiscFormulaCatalog } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { getCurrentScopeEntry } from '../gameDataPacks/currentScopeManifest'
import {
  candidateConstraintToDiscProfile,
  getCandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { compileDynamicCandidateLoadout, dynamicLegalInventory } from './teamDynamicDomain'

describe('current adopted drive-disc identities in dynamic inventory', () => {
  it('retains every released account-ownable set from the current formula and scope catalogs', () => {
    const sets = currentDriveDiscFormulaCatalog.items.filter((set) => {
      const scope = getCurrentScopeEntry(set.stableId)
      return scope?.releaseState === 'released' && scope.accountOwnable
    })
    const discs = sets.map((set, index) => legalTeamDisc(index, { setId: set.stableId }))
    expect(sets.length).toBeGreaterThan(0)
    expect(dynamicLegalInventory(discs)).toEqual(discs)
    expect(new Set(dynamicLegalInventory(discs).map((disc) => disc.setId))).toContain('set-34200')
  })

  it('keeps all twelve legal Claret records and compiles the adopted Thorned Rose four-piece', () => {
    const discs = Array.from({ length: 12 }, (_, index) =>
      legalTeamDisc(index, {
        setId: index % 6 < 4 ? 'set-34200' : 'set-hormone-punk',
      }),
    )
    const profile = candidateConstraintToDiscProfile(
      getCandidateWarehouseConstraint('agent-claret')!,
    )!
    expect(profile).not.toBeNull()
    expect(dynamicLegalInventory(discs)).toHaveLength(12)
    const selected = compileDynamicCandidateLoadout(discs.slice(0, 6), profile)
    expect(selected).not.toBeNull()
    expect(selected!.setCounts).toEqual({ 'set-34200': 4, 'set-hormone-punk': 2 })
    expect(selected!.setPattern).toBe('4+2')
  })

  it('still refuses invented set identities and invalid enhancement records on an adopted current set', () => {
    const legal = legalTeamDisc(0, { setId: 'set-34200' })
    const unknown = legalTeamDisc(1, { setId: 'set-fictional-3.2' })
    const invalid = legalTeamDisc(2, { setId: 'set-34200' })
    invalid.subStats[0]!.value = 999
    expect(dynamicLegalInventory([legal, unknown, invalid])).toEqual([legal])
  })

  it('preserves distinct physical inventories when legal ids contain separators', () => {
    const profile = candidateConstraintToDiscProfile(
      getCandidateWarehouseConstraint('agent-claret')!,
    )!
    const leftIds = ['a|b', 'c', 'd', 'e', 'f', 'g']
    const rightIds = ['a', 'b|c', 'd', 'e', 'f', 'g']
    expect(leftIds.join('|')).toBe(rightIds.join('|'))
    const compile = (ids: string[]) =>
      compileDynamicCandidateLoadout(
        ids.map((id, index) => legalTeamDisc(index, { id })),
        profile,
      )!
    const left = compile(leftIds)
    const right = compile(rightIds)
    expect([...left.discIds]).toEqual(leftIds)
    expect([...right.discIds]).toEqual(rightIds)
    expect(left.discIds).not.toEqual(right.discIds)
  })
})
