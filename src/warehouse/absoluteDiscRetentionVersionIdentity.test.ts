import { describe, expect, it } from 'vitest'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import {
  absoluteDiscRetentionCatalog as catalog,
  absoluteDiscRetentionCatalogHash,
  absoluteDiscRetentionPolicy as policy,
  hashAbsoluteDiscRetentionCatalog,
  toAbsoluteRetentionDisc,
} from './absoluteDiscRetentionCatalog'
import { assessDisc, type Catalog } from './absoluteDiscRetentionKernel'
import { warehouseClearAlternative, warehouseTestDisc } from './discWarehouseAnalysis.testFixtures'

function isolatedCatalog(): Catalog {
  const profile = catalog.profiles.find((row) => row.agentId === 'agent-nicole')!
  return {
    ...catalog,
    releasedAgentIds: [profile.agentId],
    coverageGaps: [],
    branchCoverageComplete: true,
    profiles: [
      {
        ...profile,
        functionalMains: [],
        weights: { crit_rate: 1 },
        coreStats: ['crit_rate'],
        goal: 'crit_damage',
        weightEvidence: {
          id: 'synthetic-scope',
          method: 'synthetic_quality',
          sourceIds: profile.sourceIds,
        },
        qualityInputEvidence: {},
      },
    ],
  }
}

const lowDisc = (id: string) =>
  toAbsoluteRetentionDisc(
    warehouseTestDisc(id, {
      slot: 6,
      mainStat: 'energy_regen',
      setId: 'set-swing-jazz',
      subStats: [
        { stat: 'hp_flat', value: 672, upgrades: 5 },
        { stat: 'def_flat', value: 15, upgrades: 0 },
        { stat: 'atk_flat', value: 19, upgrades: 0 },
        { stat: 'hp_percent', value: 3, upgrades: 0 },
      ],
    }),
  )

describe('retention analysis and historical source identities', () => {
  it('adopts the current analysis scope while retaining original policy and source versions', () => {
    const source = structuredClone(getCandidateWarehouseConstraint('agent-billy')!)
    expect(catalog.factsGameVersion).toBe(currentVersionProjection.gameVersion)
    expect(catalog.assessmentGameVersion).toBe('3.2')
    expect(catalog.versionIdentity).toMatchObject({
      analysisTargetVersion: '3.2',
      policyCalibrationVersion: '3.1',
      adoption: {
        id: currentVersionProjection.adoptionId,
        contentHash: currentVersionProjection.adoptionContentHash,
        sourceCommit: currentVersionProjection.sourceCommit,
        referenceReviewVersion: '3.1',
      },
    })
    expect(catalog.versionIdentity!.sourceOriginalVersions).toContain('3.0')
    expect(catalog.versionIdentity!.sourceOriginalVersions).toContain('3.2')
    expect(catalog.reviewedUseScope).toContain(`3.2:`)
    expect(catalog.releasedAgentIds).toEqual(expect.arrayContaining(['agent-claret', 'agent-roxy']))
    expect(getCandidateWarehouseConstraint('agent-billy')).toEqual(source)
    expect(policy.id).toContain('absolute-disc-retention-3.1-stage-r4:')
    for (const slots of Object.values(policy.byProfile))
      for (const cutoffs of Object.values(slots))
        expect(cutoffs).toEqual({ cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 })
  })

  it('rejects an adoption mismatch even when both legacy version strings match', () => {
    const mismatched: Catalog = {
      ...isolatedCatalog(),
      versionIdentity: {
        ...catalog.versionIdentity!,
        adoption: { ...catalog.versionIdentity!.adoption, targetVersion: '3.1' },
      },
    }
    const decision = assessDisc(lowDisc('mismatched'), mismatched, policy)
    expect(decision.blockedBy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'versionIdentity', kind: 'missing_fact' }),
      ]),
    )
  })

  it('changes result identity when adoption changes, preserving quality and protection rules', () => {
    const changed: Catalog = {
      ...catalog,
      versionIdentity: {
        ...catalog.versionIdentity!,
        adoption: { ...catalog.versionIdentity!.adoption, contentHash: 'different-adoption' },
      },
    }
    expect(hashAbsoluteDiscRetentionCatalog(catalog)).toBe(absoluteDiscRetentionCatalogHash)
    expect(hashAbsoluteDiscRetentionCatalog(changed)).not.toBe(absoluteDiscRetentionCatalogHash)
    const disc = toAbsoluteRetentionDisc(warehouseClearAlternative())
    const legacy: Catalog = {
      ...catalog,
      versionIdentity: undefined,
      factsGameVersion: '3.1',
      assessmentGameVersion: '3.1',
      reviewedUseScope: '3.1:previous-scope',
    }
    const current = assessDisc(disc, catalog, policy)
    const previous = assessDisc(disc, legacy, policy)
    expect(current.evidence).toEqual(previous.evidence)
    expect(current.bestUseScore).toBe(previous.bestUseScore)
    expect(current.qualityDisposition).toBe(previous.qualityDisposition)
    expect(assessDisc(disc, catalog, policy, { protected: true }).recommendation).toBe('protected')
  })

  it('limits an unadopted build gap to discs with a possible use in that profile', () => {
    const isolated = isolatedCatalog()
    const profile = isolated.profiles[0]!
    const withGap: Catalog = {
      ...isolated,
      branchCoverageComplete: false,
      coverageGaps: [
        {
          profileId: profile.id,
          agentId: profile.agentId,
          field: 'reviewed-use-adoption',
          detail: 'Synthetic unadopted build evidence.',
          sourceIds: profile.sourceIds,
        },
      ],
    }
    const related = lowDisc('related')
    const unrelated = { ...related, id: 'unrelated', slot: 4, mainStat: 'crit_rate' }
    expect(profile.mainStatsBySlot['4']?.crit_rate).toBe('incompatible')
    expect(profile.mainStatsBySlot['6']?.energy_regen).toBe('valid')
    expect(
      assessDisc(unrelated, withGap, policy).blockedBy.some(
        (gap) => gap.field === 'reviewed-use-adoption',
      ),
    ).toBe(false)
    expect(
      assessDisc(related, withGap, policy).blockedBy.some(
        (gap) => gap.field === 'reviewed-use-adoption',
      ),
    ).toBe(true)
  })
})
