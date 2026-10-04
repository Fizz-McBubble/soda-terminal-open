/**
 * Testing-only shared materializer for the constraint-aware team warehouse fixture.
 *
 * Both the Vitest optimizer-flow suites and the real public-build journey E2E must seed the same
 * account shape, so the rules live here once: pick the team, read each member's published warehouse
 * constraint, own exactly that team, own every released account-ownable W-Engine, and materialize
 * one six-disc loadout per member from the constraint's set plans and main-stat options.
 *
 * The module is imported by tests and by the E2E's dev-server fixture page only; it never enters a
 * production bundle.
 */
import type { SodaDatabase } from '../db/database'
import { createAccount, saveAccountRoster } from '../accounts/repository'
import { saveAccountPlanningDraft } from '../accounts/planningDrafts'
import { scopeLegacyEntity } from '../accounts/types'
import {
  createEmptyRoster,
  currentAgentDirectory,
  currentBangbooDirectory,
} from '../assault/catalog'
import { currentWEngineDirectory } from '../assault/planningCatalog'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { sampleDiscs } from '../evaluation/fixtures'
import type { DriveDisc } from '../domain/schemas'

export type TeamWarehouseMaterializerOptions = {
  sameCoreAlternatives?: boolean
  remainingBoxTeams?: boolean
  unsupportedLegacyTeam?: boolean
  noDefaultBangbooTeam?: boolean
  /** Account identity; the optimizer-flow suites keep their historical ids by default. */
  account?: { id?: string; displayName?: string }
  /** The saved single-agent draft is part of the optimizer-flow fixture, not of the discs rules. */
  includePlanningDraft?: boolean
}

export type TeamWarehouseMaterializerResult = {
  accountId: string
  displayName: string
  memberIds: string[]
  discs: DriveDisc[]
}

export function teamWarehouseMaterializerMemberIds(
  options: TeamWarehouseMaterializerOptions = {},
): string[] {
  return options.unsupportedLegacyTeam
    ? ['agent-billy', 'agent-qingyi', 'agent-nicole']
    : options.remainingBoxTeams
      ? ['agent-yixuan', 'agent-dialyn', 'agent-lucia', 'agent-billy', 'agent-nicole', 'agent-anby']
      : options.noDefaultBangbooTeam
        ? ['agent-burnice', 'agent-grace', 'agent-rina']
        : options.sameCoreAlternatives
          ? ['agent-remielle', 'agent-velina', 'agent-aria', 'agent-promeia']
          : ['agent-yixuan', 'agent-dialyn', 'agent-lucia']
}

export async function materializeTeamWarehouse(
  database: SodaDatabase,
  options: TeamWarehouseMaterializerOptions = {},
): Promise<TeamWarehouseMaterializerResult> {
  const accountId = options.account?.id ?? 'account-team-isolated'
  const displayName = options.account?.displayName ?? '整队隔离账户'
  const teamAgentIds = teamWarehouseMaterializerMemberIds(options)
  const constraints = teamAgentIds.map((agentId) => {
    const constraint = getCandidateWarehouseConstraint(agentId)
    if (!constraint) throw new Error(`Missing test warehouse constraint for ${agentId}`)
    return constraint
  })
  const account = await createAccount(displayName, database, {
    id: accountId,
    makeDefault: true,
  })
  const roster = createEmptyRoster()
  const ownableAgentIds = new Set(
    currentAgentDirectory
      .filter((agent) => agent.releaseState === 'released' && agent.accountOwnable)
      .map((agent) => agent.id),
  )
  const ownableBangbooIds = new Set(
    currentBangbooDirectory
      .filter((bangboo) => bangboo.releaseState === 'released' && bangboo.accountOwnable)
      .map((bangboo) => bangboo.id),
  )
  roster.agents = roster.agents.map((agent) => ({
    ...agent,
    owned:
      teamAgentIds.includes(agent.agentId) &&
      (ownableAgentIds.has(agent.agentId) || options.sameCoreAlternatives === true),
  }))
  roster.bangboos = roster.bangboos.map((bangboo) => ({
    ...bangboo,
    owned:
      ownableBangbooIds.has(bangboo.bangbooId) &&
      ['bangboo-belion', 'bangboo-knightboo', 'bangboo-ariel', 'bangboo-plugboo'].includes(
        bangboo.bangbooId,
      ),
  }))
  roster.wEngines = [
    ...new Map(
      currentWEngineDirectory
        .filter((engine) => engine.releaseState === 'released' && engine.accountOwnable)
        .map((engine) => [engine.id, engine]),
    ).values(),
  ].map((engine) => ({
    copyId: `test-${engine.id}`,
    engineId: engine.id,
    level: 60,
    refinement: 5,
    equippedAgentId: null,
    manualSource: 'manual_initial_default' as const,
  }))
  await saveAccountRoster(account.id, roster, database)
  const discs: DriveDisc[] = constraints.flatMap((constraint, index) =>
    Array.from({ length: 6 }, (_, offset) => {
      const slot = (offset + 1) as 1 | 2 | 3 | 4 | 5 | 6
      const mainStat =
        slot === 4
          ? (constraint.mainStats['4']?.[0] ?? 'crit_rate')
          : slot === 5
            ? (constraint.mainStats['5']?.[0] ?? 'physical_dmg')
            : slot === 6
              ? (constraint.mainStats['6']?.[0] ?? 'atk_percent')
              : slot === 1
                ? 'hp_flat'
                : slot === 2
                  ? 'atk_flat'
                  : 'def_flat'
      return {
        ...sampleDiscs.treasureCandidate,
        id: `team-${index}-${slot}`,
        slot,
        // Real account discs always carry their rarity; the display contract derives the main-stat
        // value from rarity + level, so a rarity-less fixture could only ever show "数值资料待补齐".
        rarity: 'S' as const,
        level: 15,
        mainStat,
        setId: constraint.setIds[offset < 4 ? 0 : 1] ?? constraint.setIds[0]!,
      }
    }),
  )
  await database.accountDriveDiscs.bulkPut(
    discs.map((disc) => scopeLegacyEntity(account.id, disc, new Date().toISOString())),
  )
  if (options.includePlanningDraft !== false)
    await saveAccountPlanningDraft(
      account.id,
      {
        id: 'plan-billy-long',
        kind: 'agent',
        name: '比利长期方案',
        selection: { agentIds: ['agent-billy'], bangbooId: null, scenario: '单角色长期方案' },
        manualOverrides: {
          wEngineDirection: '',
          discDirection: '',
          progressionDirection: '',
          notes: '',
        },
        knowledgeRefs: [],
        warehouseRefs: discs.filter((disc) => disc.id.startsWith('team-0-')).map((disc) => disc.id),
        comparisonCapability: 'direction',
      },
      database,
    )
  return { accountId: account.id, displayName, memberIds: teamAgentIds, discs }
}
