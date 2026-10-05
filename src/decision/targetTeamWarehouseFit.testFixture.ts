import type { DriveDisc } from '../domain/schemas'
import { sampleDiscs } from '../evaluation/fixtures'
import {
  candidateSetPlansForConstraint,
  getCandidateWarehouseConstraint,
  type CandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'

export const targetTeamComparisonMembers = ['agent-nekomata', 'agent-nicole', 'agent-anby'] as const

export function sourceBranchDiscs(agentId: string, copy: number): DriveDisc[] {
  const constraint = getCandidateWarehouseConstraint(agentId)
  if (!constraint) throw new Error(`missing fixture constraint: ${agentId}`)
  const branch = candidateSetPlansForConstraint(constraint)[0]
  if (!branch) throw new Error(`missing fixture branch: ${agentId}`)
  const setIds =
    branch.pattern === '4+2'
      ? [
          ...Array(4).fill(branch.primarySetIds[0]),
          ...Array(2).fill(
            branch.secondarySetIds.find((setId) => setId !== branch.primarySetIds[0]),
          ),
        ]
      : branch.primarySetIds.slice(0, 3).flatMap((setId) => [setId, setId])
  if (setIds.length !== 6 || setIds.some((setId) => !setId))
    throw new Error(`fixture branch is incomplete: ${agentId}`)
  return setIds.map((setId, index) => {
    const slot = (index + 1) as DriveDisc['slot']
    return {
      ...sampleDiscs.treasureCandidate,
      id: `${agentId}-${copy}-${slot}`,
      setId: setId!,
      slot,
      level: 15,
      rarity: 'S',
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
}

export function syntheticBranchConstraint(
  agentId: string,
  template: CandidateWarehouseConstraint,
): CandidateWarehouseConstraint {
  const preferred = {
    pattern: '4+2' as const,
    priority: 0,
    primarySetIds: ['set-test-preferred-primary'],
    secondarySetIds: ['set-test-preferred-secondary'],
  }
  const alternative = {
    pattern: '4+2' as const,
    priority: 1,
    primarySetIds: ['set-test-alternative-primary'],
    secondarySetIds: ['set-test-alternative-secondary'],
  }
  return {
    ...template,
    agentId,
    setIds: [
      'set-test-preferred-primary',
      'set-test-preferred-secondary',
      'set-test-alternative-primary',
      'set-test-alternative-secondary',
    ],
    setPlans: [preferred, alternative],
    setPlanReadiness: { status: 'executable', ...preferred },
    mainStats: { '4': ['atk_percent'], '5': ['atk_percent'], '6': ['atk_percent'] },
    subStatWeights: { atk_percent: 1 },
    contentHash: `synthetic-branch-${agentId}`,
  }
}

export function branchPool(prefix: 'preferred' | 'alternative', copies: number): DriveDisc[] {
  return Array.from({ length: copies }, (_, copy) =>
    [1, 2, 3, 4, 5, 6].map(
      (slot): DriveDisc => ({
        ...sampleDiscs.treasureCandidate,
        id: `${prefix}-${copy}-${slot}`,
        setId: slot <= 4 ? `set-test-${prefix}-primary` : `set-test-${prefix}-secondary`,
        slot: slot as DriveDisc['slot'],
        level: 15,
        rarity: 'S',
        mainStat:
          slot === 1
            ? 'hp_flat'
            : slot === 2
              ? 'atk_flat'
              : slot === 3
                ? 'def_flat'
                : 'atk_percent',
        subStats: [],
        locked: false,
      }),
    ),
  ).flat()
}

export function isolatedPartialConstraint(
  agentId: string,
  prefix: string,
  includeAlternative: boolean,
): CandidateWarehouseConstraint {
  const template = getCandidateWarehouseConstraint(agentId)
  if (!template) throw new Error(`missing partial fixture constraint: ${agentId}`)
  const preferred = {
    pattern: '4+2' as const,
    priority: 0,
    primarySetIds: [`set-${prefix}-preferred-primary`],
    secondarySetIds: [`set-${prefix}-preferred-secondary`],
  }
  const alternative = {
    pattern: '2+2+2' as const,
    priority: 1,
    primarySetIds: [
      `set-${prefix}-alternative-a`,
      `set-${prefix}-alternative-b`,
      `set-${prefix}-alternative-c`,
    ],
    secondarySetIds: [] as string[],
  }
  const setPlans = includeAlternative ? [preferred, alternative] : [preferred]
  return {
    ...template,
    agentId,
    status: 'candidate',
    setIds: [
      ...preferred.primarySetIds,
      ...preferred.secondarySetIds,
      ...alternative.primarySetIds,
    ],
    setPlans,
    setPlanReadiness: { status: 'executable', ...preferred },
    mainStats: { '4': ['atk_percent'], '5': ['atk_percent'], '6': ['atk_percent'] },
    subStatWeights: { crit_dmg: 1, atk_percent: 1 },
    contentHash: `isolated-partial-${agentId}`,
  }
}

export function isolatedPlanDiscs(input: {
  prefix: string
  branch: 'preferred' | 'alternative'
  slots?: readonly DriveDisc['slot'][]
}) {
  const slots = input.slots ?? ([1, 2, 3, 4, 5, 6] as const)
  return slots.map((slot, index): DriveDisc => {
    const setId =
      input.branch === 'preferred'
        ? slot <= 4
          ? `set-${input.prefix}-preferred-primary`
          : `set-${input.prefix}-preferred-secondary`
        : `set-${input.prefix}-alternative-${['a', 'a', 'b', 'b', 'c', 'c'][index]}`
    return {
      ...sampleDiscs.treasureCandidate,
      id: `${input.prefix}-${input.branch}-${slot}`,
      setId,
      slot,
      mainStat:
        slot === 1 ? 'hp_flat' : slot === 2 ? 'atk_flat' : slot === 3 ? 'def_flat' : 'atk_percent',
      subStats: input.branch === 'alternative' ? sampleDiscs.treasureCandidate.subStats : [],
    }
  })
}
