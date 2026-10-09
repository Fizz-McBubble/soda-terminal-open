import { fixture as planningFixture } from './targetTeamPlanningContext.testFixture'
import { compileTeamBuildIntent } from './buildIntent'
import type { DriveDisc } from '../domain/schemas'
import { driveDiscData } from '../data/gameData'

export function legalTeamDisc(index: number, overrides: Partial<DriveDisc> = {}): DriveDisc {
  const slot = (index % 6) + 1
  const mainStat =
    slot === 1 ? 'hp_flat' : slot === 2 ? 'atk_flat' : slot === 3 ? 'def_flat' : 'atk_percent'
  const steps = new Map(
    driveDiscData!.rules.subStatStepsByRarity.S.map((row) => [row.stat, row.baseValue]),
  )
  const stats = ['crit_rate', 'crit_dmg', 'hp_percent', 'pen'] as const
  const upgrades = [0, 0, 5, 0]
  return {
    id: `legal-team-${index}`,
    setId: ['set-woodpecker-electro', 'set-chaotic-metal', 'set-hormone-punk'][
      Math.floor((slot - 1) / 2)
    ]!,
    slot: slot as DriveDisc['slot'],
    level: 15,
    rarity: 'S',
    mainStat,
    subStats: stats.map((stat, position) => ({
      stat,
      upgrades: upgrades[position]!,
      value: steps.get(stat)! * (upgrades[position]! + 1),
    })),
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
    dataVersion: 'synthetic-game-legal-20261008',
    ...overrides,
  }
}

export function teamDynamicFixture() {
  const input = planningFixture()
  input.warehouse.discs = Array.from({ length: 18 }, (_, index) => legalTeamDisc(index))
  input.fit.loadouts = input.candidate.memberIds.map((agentId, member) => ({
    agentId,
    discIds: input.warehouse.discs.slice(member * 6, member * 6 + 6).map((disc) => disc.id),
  }))
  input.warehouse.roster.agents = input.warehouse.roster.agents.map((agent) => ({
    ...agent,
    equippedDiscIds:
      input.fit.loadouts.find((row) => row.agentId === agent.agentId)?.discIds ?? null,
  }))
  const buildIntent = compileTeamBuildIntent({
    candidateId: input.candidate.candidateId,
    memberIds: input.candidate.memberIds,
    bangbooId: input.parameters.bangbooId!,
  })
  // Independent arithmetic/search fixture: the inactive conditions are explicit
  // inputs, not production defaults. Player queries deliberately do not receive
  // this fixture-only field and must retain unknown coverage.
  const calibrationObservations = {
    authority: 'independent_calibration' as const,
    id: 'cunning-hares-no-bullets-no-chain-no-prior-third-basic',
    referencesByAgentId: {
      'agent-billy': { ult_dmg_stacks: 0 },
      'agent-nicole': { bulletsOrFieldHit: false },
      'agent-anby': { core_after3rdBasic: false },
    },
  }
  return { ...input, buildIntent, calibrationObservations }
}
