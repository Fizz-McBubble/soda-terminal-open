import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { n4ValidationDisc } from '../testing/n4RecommendationValidationFixture'
import { calculateTargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import { projectTargetTeamAccountBoundBenchmark } from './targetTeamAccountBoundBenchmark'
import { defaultEquipmentRankForRarity } from './teamEquipmentRecommendations'
import { compileTeamBuildIntent } from './buildIntent'
import { compileAgentBuildIntent, buildIntentFingerprintMatches } from './buildIntent'
import { sampleDiscs } from '../evaluation/fixtures'
import { driveDiscData } from '../data/gameData'
import type { DriveDisc } from '../domain/schemas'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import {
  absoluteDiscRetentionCatalog,
  toAbsoluteRetentionDisc,
} from '../warehouse/absoluteDiscRetentionCatalog'
import { history } from '../warehouse/absoluteDiscRetentionScoring'
import {
  branchPool,
  syntheticBranchConstraint,
  targetTeamComparisonMembers as comparisonMembers,
} from './targetTeamWarehouseFit.testFixture'

describe('explicit target-team warehouse fit', () => {
  it.each([
    ['agent-remielle', 'agent-velina', 'agent-yanagi'],
    ['agent-miyabi', 'agent-remielle', 'agent-velina'],
    ['agent-miyabi', 'agent-remielle', 'agent-yanagi'],
  ] as const)(
    'carries the exact nonstandard branch through an 18-disc solve and replay for %j',
    (...members) => {
      const memberIds = members as [string, string, string]
      const intent = compileTeamBuildIntent({
        candidateId: `condition:${memberIds.join('+')}`,
        memberIds,
        bangbooId: 'bangboo-ariel',
      })
      const roster = createEmptyRoster('2026-10-14T00:00:00.000Z')
      for (const member of roster.agents)
        if (memberIds.includes(member.agentId)) member.owned = true
      const discs: DriveDisc[] = intent.recommendations.flatMap(({ agentId, constraint }) => {
        if (!constraint || constraint.setPlanReadiness.status !== 'executable')
          throw new Error('missing test source branch')
        const plan = constraint.setPlanReadiness
        return Array.from({ length: 6 }, (_, index) => {
          const slot = (index + 1) as DriveDisc['slot']
          return {
            ...sampleDiscs.treasureCandidate,
            id: `${agentId}:condition:${slot}`,
            rarity: 'S' as const,
            level: 15,
            slot,
            setId: index < 4 ? plan.primarySetIds[0]! : plan.secondarySetIds[0]!,
            mainStat:
              slot === 1
                ? 'hp_flat'
                : slot === 2
                  ? 'atk_flat'
                  : slot === 3
                    ? 'def_flat'
                    : constraint.mainStats[String(slot) as '4' | '5' | '6']![0]!,
            subStats: [],
            locked: false,
          }
        })
      })
      const warehouse = { accountId: 'condition-fixture-only', account: null, roster, discs }
      const before = JSON.stringify(warehouse)
      const fit = calculateTargetTeamWarehouseFit({
        warehouse,
        buildIntent: intent,
        bangbooSelection: { status: 'selected', bangbooId: 'bangboo-ariel' },
      })
      expect(fit.status, JSON.stringify(fit.gaps)).toBe('ready')
      expect(fit.uniqueDiscCount).toBe(18)
      const actorId = memberIds.includes('agent-miyabi') ? 'agent-miyabi' : 'agent-yanagi'
      const actor = fit.warehousePlan.loadouts.find((row) => row.agentId === actorId)!
      expect(actor.discs.filter((row) => row.disc.setId === 'set-freedom-blues')).toHaveLength(4)
      expect(actor.discs.find((row) => row.disc.slot === 4)?.disc.mainStat).toBe(
        'anomaly_proficiency',
      )
      expect(actor.discs.find((row) => row.disc.slot === 6)?.disc.mainStat).toBe('anomaly_mastery')
      const restored = JSON.parse(JSON.stringify(fit.buildIntent)) as typeof intent
      expect(buildIntentFingerprintMatches(restored)).toBe(true)
      const replay = calculateTargetTeamWarehouseFit({
        warehouse,
        buildIntent: restored,
        bangbooSelection: { status: 'selected', bangbooId: 'bangboo-ariel' },
      })
      expect(replay.loadouts).toEqual(fit.loadouts)
      expect(replay.fingerprint).toBe(fit.fingerprint)
      expect(JSON.stringify(warehouse)).toBe(before)
      if (actorId === 'agent-yanagi') {
        for (const main5 of ['pen_ratio', 'electric_dmg'] as const)
          for (const main6 of ['anomaly_mastery', 'energy_regen'] as const) {
            const alternativeDiscs = discs.map((disc) =>
              disc.id.startsWith(`${actorId}:`)
                ? {
                    ...disc,
                    mainStat: disc.slot === 5 ? main5 : disc.slot === 6 ? main6 : disc.mainStat,
                  }
                : disc,
            )
            const alternative = calculateTargetTeamWarehouseFit({
              warehouse: { ...warehouse, discs: alternativeDiscs },
              buildIntent: intent,
              bangbooSelection: { status: 'selected', bangbooId: 'bangboo-ariel' },
            })
            expect(alternative.status).toBe('ready')
            const assigned = alternative.warehousePlan.loadouts.find(
              (row) => row.agentId === actorId,
            )!
            expect(assigned.discs.find((row) => row.disc.slot === 5)?.disc.mainStat).toBe(main5)
            expect(assigned.discs.find((row) => row.disc.slot === 6)?.disc.mainStat).toBe(main6)
          }
      }
      // Conditional team advice is not silently applied to the separate individual solver.
      if (actorId === 'agent-miyabi')
        expect(
          compileAgentBuildIntent({ agentId: actorId }).recommendations[0]!.constraint!.mainStats[
            '4'
          ],
        ).not.toContain('anomaly_proficiency')
    },
  )
  it('compares later complete peer branches and is invariant to source ordering', () => {
    const roster = createEmptyRoster('2026-09-01T00:00:00.000Z')
    const discs = [...branchPool('preferred', 3), ...branchPool('alternative', 3)]
    const intent = compileTeamBuildIntent({
      candidateId: 'complete-peer-comparison',
      memberIds: comparisonMembers,
      bangbooId: 'bangboo-amillion',
    })
    const template = getCandidateWarehouseConstraint(comparisonMembers[0])!
    intent.recommendations = comparisonMembers.map((agentId) => {
      const constraint = syntheticBranchConstraint(agentId, template)
      constraint.setPlans = constraint.setPlans!.map((plan) => ({ ...plan, priority: 0 }))
      return { agentId, constraint }
    })
    const objective = {
      fingerprint: 'prefer-explicit-test-team-output',
      evaluate: (loadouts: readonly { discs: { disc: DriveDisc }[] }[]) =>
        loadouts.flatMap((item) => item.discs).filter(({ disc }) => disc.id.startsWith('preferred'))
          .length,
    }
    const solve = () =>
      calculateTargetTeamWarehouseFit({
        warehouse: { accountId: 'complete-peers', account: null, roster, discs },
        buildIntent: intent,
        bangbooSelection: { status: 'selected', bangbooId: 'bangboo-amillion' },
        teamAssignmentObjective: objective,
      })
    const result = solve()
    expect(result.status).toBe('ready')
    expect(result.sourceBranchSearch).toMatchObject({
      attempts: 8,
      completePlansCompared: 8,
      searchComplete: true,
    })
    expect(objective.evaluate(result.warehousePlan.loadouts)).toBe(18)
    for (const recommendation of intent.recommendations) {
      recommendation.constraint!.setPlans!.reverse()
      recommendation.constraint!.setIds.reverse()
    }
    const reordered = solve()
    expect(reordered.loadouts).toEqual(result.loadouts)
    expect(reordered.totalScore).toEqual(result.totalScore)
  })
  it('uses different S and A rarity defaults while keeping the rank overridable', () => {
    expect(defaultEquipmentRankForRarity('S')).toBe(1)
    expect(defaultEquipmentRankForRarity('A')).toBe(5)
    expect(defaultEquipmentRankForRarity('B')).toBe(5)
  })

  it('runs only for the requested team and keeps incomplete disc evidence fail-closed', () => {
    const roster = createEmptyRoster('2026-09-01T00:00:00.000Z')
    const result = calculateTargetTeamWarehouseFit({
      warehouse: {
        accountId: 'target-fit-account',
        account: null,
        roster,
        discs: Array.from({ length: 400 }, (_, index) => n4ValidationDisc(index)),
      },
      buildIntent: compileTeamBuildIntent({
        candidateId: 'target-billy-nicole-anby',
        memberIds: ['agent-billy', 'agent-nicole', 'agent-anby'],
        bangbooId: 'bangboo-amillion',
      }),
      bangbooSelection: { status: 'selected', bangbooId: 'bangboo-amillion' },
    })

    expect(result.sideEffect).toBe('read_only')
    expect(result.buildIntent).toMatchObject({
      contract: 'soda-build-intent/v1',
      scope: 'team_joint',
      resourcePolicy: 'within_team_exclusive',
    })
    expect(result.status).toBe('unavailable')
    expect(result.solverMethod).toBe('bounded_heuristic')
    expect(result.equipmentRecommendations).toMatchObject({
      parameterConfirmation: 'required_before_numeric_calculation',
      bangboo: { primaryBangbooId: 'bangboo-amillion' },
    })
    expect(result.equipmentRecommendations.wEngines).toHaveLength(3)
    expect(result.equipmentRecommendations.wEngines.some((item) => item.recommendedPrimary)).toBe(
      true,
    )
    for (const recommendation of result.equipmentRecommendations.wEngines) {
      for (const option of [
        recommendation.recommendedPrimary,
        ...recommendation.recommendedAlternatives,
      ].filter(Boolean)) {
        expect(option?.refinement).toBe(option?.rarity === 'S' ? 1 : 5)
      }
    }
    for (const option of result.equipmentRecommendations.bangboo.options) {
      expect(option.defaultStars).toBe(option.rarity === 'S' ? 1 : 5)
    }
    expect(result.discCount).toBeLessThan(18)
    expect(result.gaps.length).toBeGreaterThan(0)

    const benchmark = projectTargetTeamAccountBoundBenchmark({
      warehouse: {
        accountId: 'target-fit-account',
        account: null,
        roster,
        discs: Array.from({ length: 400 }, (_, index) => n4ValidationDisc(index)),
      },
      candidate: {
        candidateId: result.candidateId,
      } as never,
      fit: result,
      rosterHash: 'roster-hash',
      warehouseHash: 'warehouse-hash',
      planningHash: 'planning-hash',
      capturedAt: '2026-09-01T00:00:00.000Z',
    })
    expect(benchmark).toMatchObject({
      status: 'unavailable',
      planningDps: null,
      binding: {
        status: 'unavailable',
        discMethod: 'bounded_heuristic',
        equipmentParameterStatus: 'awaiting_player_confirmation',
      },
      sideEffect: 'read_only',
    })
    expect(benchmark.binding.equipmentParameterStatus).toBe('awaiting_player_confirmation')

    const confirmed = projectTargetTeamAccountBoundBenchmark({
      warehouse: {
        accountId: 'target-fit-account',
        account: null,
        roster,
        discs: Array.from({ length: 400 }, (_, index) => n4ValidationDisc(index)),
      },
      candidate: {
        candidateId: result.candidateId,
        memberIds: result.memberIds,
      } as never,
      fit: result,
      rosterHash: 'roster-hash',
      warehouseHash: 'warehouse-hash',
      planningHash: 'planning-hash',
      capturedAt: '2026-09-01T00:00:00.000Z',
      equipmentParameters: {
        wEngines: result.equipmentRecommendations.wEngines.map((item) => ({
          agentId: item.agentId,
          engineId: item.recommendedPrimary!.engineId,
          refinement: item.recommendedPrimary!.refinement,
        })),
        bangbooId: 'bangboo-amillion',
        bangbooStars:
          result.equipmentRecommendations.bangboo.options.find(
            (item) => item.bangbooId === 'bangboo-amillion',
          )?.defaultStars ?? 1,
      },
    })
    expect(confirmed).toMatchObject({
      status: 'unavailable',
      binding: { equipmentParameterStatus: 'confirmed_but_calculation_unsupported' },
    })
    expect(confirmed.equipmentParameters?.wEngines).toHaveLength(3)
    expect(confirmed.calculationEvidence).toContain(
      '方案参数按显式音擎等级与突破、所选精炼计算；未提供等级的旧参数保留声明式60级基线。邦布仍采用60级与所选星级。',
    )
    expect(confirmed.equipmentModifierProjection?.fingerprint).toBeTruthy()
    expect(confirmed.equipmentModifierProjection?.bangboo.starModifierStatus).toBe('supported')
    expect(confirmed.equipmentModifierProjection?.bangboo.directDamage).toBeGreaterThan(0)
  })

  it('passes a source-conditioned team set plan through the target-team solver', () => {
    const roster = createEmptyRoster('2026-09-01T00:00:00.000Z')
    const slots = [1, 2, 3, 4, 5, 6] as const
    const discs: DriveDisc[] = driveDiscData!.driveDiscSets.flatMap((set) =>
      slots.map((slot) => ({
        ...sampleDiscs.treasureCandidate,
        id: `conditioned-${set.id}-${slot}`,
        setId: set.id,
        rarity: 'S',
        slot,
        mainStat: (
          {
            1: 'hp_flat',
            2: 'atk_flat',
            3: 'def_flat',
            4: 'crit_rate',
            5: 'physical_dmg',
            6: 'atk_percent',
          } as const
        )[slot],
        // Preserve five real upgrades while avoiding a duplicate main/substat.
        subStats: sampleDiscs.treasureCandidate.subStats.map((line) =>
          slot === 6 && line.stat === 'atk_percent'
            ? { stat: 'crit_rate' as const, value: 7.2, upgrades: 2 }
            : { ...line },
        ),
      })),
    )
    for (const disc of discs)
      expect(() =>
        history(toAbsoluteRetentionDisc(disc), absoluteDiscRetentionCatalog.rules),
      ).not.toThrow()
    const result = calculateTargetTeamWarehouseFit({
      warehouse: { accountId: 'conditioned-target-fit', account: null, roster, discs },
      buildIntent: compileTeamBuildIntent({
        candidateId: 'formation:nekomata-norma-sunna',
        memberIds: ['agent-nekomata', 'agent-norma', 'agent-sunna'],
        bangbooId: 'bangboo-ultra-jake',
        agentStateById: { 'agent-nekomata': { potentialImage: 1 } },
      }),
      bangbooSelection: { status: 'selected', bangbooId: 'bangboo-ultra-jake' },
    })
    const nekomata = result.warehousePlan.loadouts.find((item) => item.agentId === 'agent-nekomata')
    const setCounts = Object.fromEntries(
      (nekomata?.discs ?? [])
        .map((choice) => choice.disc.setId)
        .reduce(
          (counts, setId) => counts.set(setId, (counts.get(setId) ?? 0) + 1),
          new Map<string, number>(),
        ),
    )

    expect(nekomata?.discs).toHaveLength(6)
    expect(setCounts['set-white-water-ballad']).toBe(4)
    expect(
      ['set-puffer-electro', 'set-branch-blade-song', 'set-woodpecker-electro'].some(
        (setId) => setCounts[setId] === 2,
      ),
    ).toBe(true)
    expect(setCounts['set-fanged-metal'] ?? 0).toBe(0)
  })
})
