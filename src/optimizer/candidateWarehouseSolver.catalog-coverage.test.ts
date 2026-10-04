import { describe, expect, it } from 'vitest'
import { currentAgentDirectory } from '../assault/catalog'
import { driveDiscData } from '../data/gameData'
import type { DriveDisc } from '../domain/schemas'
import { sampleDiscs } from '../evaluation/fixtures'
import {
  candidateConstraintToDiscProfile,
  candidateSetPlansForConstraint,
  getCandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { candidateConstraintForAgent, solveCandidateWarehouse } from './candidateWarehouseSolver'

describe('released catalogue candidate branch coverage', () => {
  it('preserves every sourced set, legal main stat and executable set pattern in physical solving', () => {
    const coverage: Array<{ agentId: string; sourceHash: string; physicalBranches: number }> = []
    for (const agentId of new Set(
      currentAgentDirectory.map((agent) => resolveCurrentReleasedIdentity(agent.id)),
    )) {
      const constraint = candidateConstraintForAgent(agentId)
      expect(getCandidateWarehouseConstraint(agentId), `${agentId} source constraint`).toBeDefined()
      if (!constraint) continue
      const profile = candidateConstraintToDiscProfile(constraint)
      const plans = candidateSetPlansForConstraint(constraint)
      if (!profile) {
        expect(plans, agentId).toEqual([])
        continue
      }
      for (const slot of ['4', '5', '6'] as const) {
        expect(constraint.mainStats[slot]?.length, `${agentId} slot ${slot}`).toBeGreaterThan(0)
        for (const stat of constraint.mainStats[slot]!)
          expect(driveDiscData!.rules.mainStatsBySlot[slot], `${agentId} ${stat}`).toContain(stat)
      }
      let physicalBranches = 0
      for (const plan of plans) {
        for (const setId of [...plan.primarySetIds, ...plan.secondarySetIds])
          expect(profile.setFit[setId], `${agentId} ${setId} source set scoring`).toBe(1)
        const patterns: string[][] = []
        if (plan.pattern === '4+2') {
          for (const primary of plan.primarySetIds)
            for (const secondary of plan.secondarySetIds)
              if (primary !== secondary)
                patterns.push([primary, primary, primary, primary, secondary, secondary])
        } else {
          const sets = [...new Set(plan.primarySetIds)]
          for (let a = 0; a < sets.length - 2; a++)
            for (let b = a + 1; b < sets.length - 1; b++)
              for (let c = b + 1; c < sets.length; c++)
                patterns.push([sets[a]!, sets[a]!, sets[b]!, sets[b]!, sets[c]!, sets[c]!])
        }
        expect(patterns.length, `${agentId} empty source pattern`).toBeGreaterThan(0)
        for (const sets of patterns) {
          const discs: DriveDisc[] = sets.map((setId, index) => {
            const slot = (index + 1) as DriveDisc['slot']
            return {
              ...sampleDiscs.treasureCandidate,
              id: `catalogue-${agentId}-${slot}`,
              slot,
              setId,
              mainStat:
                slot <= 3
                  ? (['hp_flat', 'atk_flat', 'def_flat'] as const)[slot - 1]!
                  : constraint.mainStats[String(slot) as '4' | '5' | '6']![0]!,
              subStats: [],
            }
          })
          const result = solveCandidateWarehouse(discs, [agentId], 'agent', {}, [
            {
              agentId,
              constraint: {
                ...constraint,
                setPlans: [plan],
                setPlanReadiness: { status: 'executable', ...plan },
              },
            },
          ])
          const selected = result.loadouts[0]!
          expect(selected?.discs.length, `${agentId} ${sets.join('/')}`).toBe(6)
          expect(new Set(selected.discs.map(({ disc }) => disc.slot)).size).toBe(6)
          expect(new Set(selected.discs.map(({ disc }) => disc.id)).size).toBe(6)
          expect(selected.agentId).toBe(agentId)
          expect(result.solver?.exactWithinModel).toBe(false)
          physicalBranches++
        }
      }
      coverage.push({ agentId, sourceHash: constraint.contentHash, physicalBranches })
    }
    expect(coverage.length).toBeGreaterThan(40)
    console.info('RECOMMENDATION_CATALOGUE_COVERAGE', JSON.stringify(coverage))
  })
})
