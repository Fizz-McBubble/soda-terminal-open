import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { SodaDatabase } from '../db/database'
import { sampleDiscs } from '../evaluation/fixtures'
import type { AccountRoster } from '../assault/types'
import type { TeamExecutionPortfolio } from '../decision/teamExecutionProjection'
import { compilePortfolioBuildIntent } from '../decision/buildIntent'
import { getScopedId, scopeLegacyEntity, type AccountProfile } from './types'
import { createAccount } from './repository'
import {
  saveTeamPortfolioPlanningDraft,
  type TeamPortfolioPlanningSaveInput,
} from './teamPortfolioPlanning'
import {
  createAccountBackup,
  createEmptyPreference,
  createVaultBackup,
  preflightAccountBackup,
  preflightAccountBackupAgainstDatabase,
  preflightVaultBackup,
  restoreAccountBackup,
  restoreAccountBackupIndependently,
  restoreVaultBackup,
} from './backup'

const names: string[] = []

function rosterSnapshotFacts(
  snapshot: Awaited<ReturnType<typeof createAccountBackup>>['data']['roster'],
) {
  if (!snapshot) return null
  const facts = { ...snapshot }
  Reflect.deleteProperty(facts, 'exportedAt')
  return JSON.parse(JSON.stringify(facts)) as typeof facts
}

function rawRosterSemanticFacts(roster: AccountRoster) {
  const facts = { ...roster }
  Reflect.deleteProperty(facts, 'updatedAt')
  return {
    ...facts,
    agents: facts.agents.map((agent) => {
      const semanticAgent = { ...agent }
      Reflect.deleteProperty(semanticAgent, 'source')
      return semanticAgent
    }),
  }
}

function createDatabase() {
  const name = `soda-account-backup-${crypto.randomUUID()}`
  names.push(name)
  return new SodaDatabase(name)
}

afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

function profile(id: string, name: string): AccountProfile {
  return {
    id,
    displayName: name,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
    isDefault: false,
    status: 'active',
    source: 'manual',
  }
}

function completePortfolioSnapshot(): TeamExecutionPortfolio {
  const executions = Array.from({ length: 2 }, (_, teamIndex) => {
    const memberIds = Array.from(
      { length: 3 },
      (_, memberIndex) => `agent-backup-portfolio-${teamIndex + 1}-${memberIndex + 1}`,
    ) as [string, string, string]
    const members = memberIds.map((agentId, memberIndex) => {
      const discIds = Array.from(
        { length: 6 },
        (_, discIndex) =>
          `backup-portfolio-disc-${teamIndex + 1}-${memberIndex + 1}-${discIndex + 1}`,
      )
      return {
        agentId,
        current: { wEngineCopyId: null, discIds: [] },
        suggested: {
          wEngine: {
            engineId: `wengine-backup-${teamIndex + 1}-${memberIndex + 1}`,
            copyId: null,
            refinement: memberIndex + 1,
            fact: 'player_confirmed_parameter' as const,
          },
          discIds,
        },
        actions: [],
        impacts: [],
        status: 'ready' as const,
      }
    })
    return {
      contract: 'soda-team-execution/r1' as const,
      candidateId: `backup-portfolio-candidate-${teamIndex + 1}`,
      reusePolicy: 'simultaneous_lock' as const,
      scenario: { identity: `scenario:backup-${teamIndex + 1}`, tags: ['fixture'] },
      memberIds,
      bangbooId: `bangboo-backup-${teamIndex + 1}`,
      bangbooStar: 4 as const,
      wEngineBindingMode: 'scheme_parameters' as const,
      members,
      physicalDiscIds: members.flatMap((member) => member.suggested.discIds),
      confirmedWEngineCopyIds: [],
      status: 'ready' as const,
      blockers: [],
      sideEffect: 'read_only' as const,
    }
  })
  return {
    contract: 'soda-team-execution/r1',
    reusePolicy: 'simultaneous_lock',
    requestedTeamCount: 2,
    wEngineBindingMode: 'scheme_parameters',
    executions,
    uniqueConfirmedWEngineCopyIds: [],
    uniquePhysicalDiscIds: executions.flatMap((execution) => execution.physicalDiscIds),
    status: 'ready',
    blockers: [],
    sideEffect: 'read_only',
  }
}

function completePortfolioInput(snapshot: TeamExecutionPortfolio): TeamPortfolioPlanningSaveInput {
  const loadouts = snapshot.executions.flatMap((execution) =>
    execution.members.map((member) => ({
      agentId: member.agentId,
      totalScore: 10,
      discIds: member.suggested.discIds,
      effectiveRolls: 6,
      setPattern: '4+2' as const,
      degraded: false,
    })),
  )
  return {
    id: 'backup-portfolio-plan',
    name: '多队备份快照',
    teamPortfolioSnapshot: snapshot,
    teamPortfolioBuildIntent: compilePortfolioBuildIntent({
      teamCount: snapshot.requestedTeamCount,
      lockedCandidateIds: snapshot.executions.map((execution) => execution.candidateId),
      resolvedTeams: snapshot.executions.map((execution) => execution.memberIds),
      equipmentParametersByCandidateId: Object.fromEntries(
        snapshot.executions.map((execution) => [
          execution.candidateId,
          {
            wEngines: execution.members.map((member) => ({
              agentId: member.agentId,
              engineId: member.suggested.wEngine!.engineId,
              refinement: member.suggested.wEngine!.refinement,
            })),
            bangbooId: execution.bangbooId,
            bangbooStars: execution.bangbooStar!,
          },
        ]),
      ),
    }),
    teamPortfolioDiscChoices: {
      contract: 'soda-team-portfolio-disc-choices/r1',
      loadouts: snapshot.executions.flatMap((execution) =>
        execution.members.map((member) => ({
          agentId: member.agentId,
          choices: member.suggested.discIds.map((discId) => ({
            discId,
            score: 10,
            mainStatScore: 8,
            subStatScore: 2,
            effectiveLines: 2,
            effectiveRolls: 3,
            wastedUpgrades: 1,
            reasons: ['backup frozen score evidence'],
          })),
        })),
      ),
    },
    candidateWarehouse: {
      scope: 'portfolio',
      totalScore: 60,
      loadouts,
      boundary: 'isolated backup fixture',
      panelObjectiveNote: '已按攻击力3000后优先异常精通比较；本次找到的方案可能仍有更合适的替代。',
    },
    solution: {
      inputFingerprint: 'backup-portfolio-input',
      solverMethod: 'bounded_heuristic',
      gameVersion: '3.1',
      knowledgeVersion: 'backup-fixture-r1',
    },
  }
}

async function seedAccount(db: SodaDatabase, accountId: string, name: string) {
  await db.accounts.add(profile(accountId, name))
  const disc = scopeLegacyEntity(
    accountId,
    { ...sampleDiscs.potentialCandidate, id: `${accountId}-disc` },
    '2026-07-06T00:00:00.000Z',
  )
  await db.accountDriveDiscs.add(disc)
  await db.accountRosters.add({
    accountId,
    roster: createEmptyRoster(),
    updatedAt: '2026-07-06T00:00:00.000Z',
    source: 'manual',
  })
  await db.accountPreferences.add(
    createEmptyPreference(accountId, 'optimizer-mode', 'general', '2026-07-06T00:00:00.000Z'),
  )
}

async function snapshotAccountState(db: SodaDatabase) {
  return {
    accounts: await db.accounts.toArray(),
    driveDiscs: await db.accountDriveDiscs.toArray(),
    discEvaluations: await db.accountDiscEvaluations.toArray(),
    scanBatches: await db.accountScanImportBatches.toArray(),
    scanItems: await db.accountScanImportItems.toArray(),
    rosters: await db.accountRosters.toArray(),
    optimizationResults: await db.accountOptimizationResults.toArray(),
    preferences: await db.accountPreferences.toArray(),
    planningDrafts: await db.accountPlanningDrafts.toArray(),
    activeAccount: await db.settings.get('active-account-id'),
  }
}

export {
  Dexie,
  afterEach,
  describe,
  expect,
  it,
  createEmptyRoster,
  SodaDatabase,
  sampleDiscs,
  compilePortfolioBuildIntent,
  getScopedId,
  scopeLegacyEntity,
  createAccount,
  saveTeamPortfolioPlanningDraft,
  createAccountBackup,
  createEmptyPreference,
  createVaultBackup,
  preflightAccountBackup,
  preflightAccountBackupAgainstDatabase,
  preflightVaultBackup,
  restoreAccountBackup,
  restoreAccountBackupIndependently,
  restoreVaultBackup,
  names,
  rosterSnapshotFacts,
  rawRosterSemanticFacts,
  createDatabase,
  profile,
  completePortfolioSnapshot,
  completePortfolioInput,
  seedAccount,
  snapshotAccountState,
}
export type {
  AccountRoster,
  TeamExecutionPortfolio,
  AccountProfile,
  TeamPortfolioPlanningSaveInput,
}
