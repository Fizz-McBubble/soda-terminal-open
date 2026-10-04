import {
  describe,
  expect,
  it,
  sampleDiscs,
  scopeLegacyEntity,
  createDatabase,
  seedAccount,
  completePortfolioSnapshot,
  completePortfolioInput,
  compilePortfolioBuildIntent,
  saveTeamPortfolioPlanningDraft,
  createAccountBackup,
  preflightAccountBackup,
  restoreAccountBackup,
  rosterSnapshotFacts,
  snapshotAccountState,
} from './backup.testFixture'
import type { SodaDatabase } from './backup.testFixture'
import { contentHash } from '../application/contentHash'
import { buildIntentFingerprintMatches } from '../application/publicBuildIntentFingerprint'
import { scanImportBatchMetaSchema, scanImportItemSchema } from '../domain/scanImportStaging'

const accountId = 'account-equipment-growth-32'
const exportTime = new Date('2026-10-04T00:00:00.000Z')
const teams = [
  ['agent-claret', 'agent-roxy', 'agent-koleda'],
  ['agent-nekomata', 'agent-nangong', 'agent-sunna'],
] as const
const potentialByAgentId = {
  'agent-claret': 0,
  'agent-roxy': 0,
  'agent-koleda': 6,
  'agent-nekomata': 4,
  'agent-nangong': 0,
  'agent-sunna': 0,
}

async function savedGrowthAccount(db: SodaDatabase, includeGrowth: boolean) {
  await seedAccount(db, accountId, '3.2 equipment growth backup')
  await db.settings.put({ key: 'active-account-id', value: accountId })
  const snapshot = completePortfolioSnapshot()
  for (const [teamIndex, execution] of snapshot.executions.entries()) {
    execution.memberIds = [...teams[teamIndex]!]
    for (const [memberIndex, member] of execution.members.entries()) {
      member.agentId = execution.memberIds[memberIndex]!
      const engine = member.suggested.wEngine!
      engine.engineId =
        member.agentId === 'agent-claret'
          ? 'wengine-14161'
          : member.agentId === 'agent-roxy'
            ? 'wengine-14162'
            : 'wengine-14002'
      if (includeGrowth) {
        engine.level = memberIndex === 0 ? 10 : memberIndex === 1 ? 30 : 60
        engine.ascension = memberIndex === 0 ? 0 : memberIndex === 1 ? 2 : 5
      }
    }
  }
  await db.accountDriveDiscs.bulkPut(
    snapshot.uniquePhysicalDiscIds.map((id, index) =>
      scopeLegacyEntity(
        accountId,
        {
          ...sampleDiscs.potentialCandidate,
          id,
          slot: ((index % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6,
          mainStat: (
            ['hp_flat', 'atk_flat', 'def_flat', 'crit_rate', 'atk_percent', 'atk_percent'] as const
          )[index % 6]!,
          favorite: index === 0,
          tags: index === 0 ? ['keep-backup'] : [],
        },
        exportTime.toISOString(),
      ),
    ),
  )
  const rosterRecord = (await db.accountRosters.get(accountId))!
  for (const execution of snapshot.executions) {
    for (const member of execution.members) {
      const index = rosterRecord.roster.agents.findIndex(
        (agent) => agent.agentId === member.agentId,
      )
      expect(index, `roster identity ${member.agentId}`).toBeGreaterThanOrEqual(0)
      const engine = member.suggested.wEngine!
      rosterRecord.roster.agents[index] = {
        ...rosterRecord.roster.agents[index]!,
        owned: true,
        potentialImage: potentialByAgentId[member.agentId as keyof typeof potentialByAgentId],
        progressionManuallySet: true,
        wEngineDetails: {
          id: engine.engineId,
          name: `synthetic ${engine.engineId}`,
          level: engine.level ?? 60,
          ...(engine.ascension !== undefined ? { ascension: engine.ascension } : {}),
          refinement: engine.refinement,
        },
      }
    }
  }
  await db.accountRosters.put(rosterRecord)
  const input = completePortfolioInput(snapshot)
  input.solution.gameVersion = '3.2'
  input.teamPortfolioBuildIntent = compilePortfolioBuildIntent({
    teamCount: snapshot.requestedTeamCount,
    lockedCandidateIds: snapshot.executions.map((execution) => execution.candidateId),
    resolvedTeams: snapshot.executions.map((execution) => execution.memberIds),
    agentStateById: Object.fromEntries(
      Object.entries(potentialByAgentId).map(([agentId, potentialImage]) => [
        agentId,
        { potentialImage },
      ]),
    ),
    equipmentParametersByCandidateId: Object.fromEntries(
      snapshot.executions.map((execution) => [
        execution.candidateId,
        {
          wEngines: execution.members.map((member) => ({
            agentId: member.agentId,
            engineId: member.suggested.wEngine!.engineId,
            refinement: member.suggested.wEngine!.refinement,
            ...(includeGrowth
              ? {
                  level: member.suggested.wEngine!.level,
                  ascension: member.suggested.wEngine!.ascension,
                }
              : {}),
          })),
          potentialByAgentId: Object.fromEntries(
            execution.memberIds.map((id) => [
              id,
              potentialByAgentId[id as keyof typeof potentialByAgentId],
            ]),
          ),
          bangbooId: execution.bangbooId!,
          bangbooStars: execution.bangbooStar!,
        },
      ]),
    ),
  })
  await saveTeamPortfolioPlanningDraft(accountId, input, db)
  // Exercise every backed-up collection with synthetic records, including historical facts.
  const timestamp = exportTime.toISOString()
  await db.accountDiscEvaluations.put(
    scopeLegacyEntity(
      accountId,
      {
        id: 'growth-evaluation',
        discId: `${accountId}-disc`,
        discVersion: 'synthetic-disc-v1',
        templateId: 'synthetic-template',
        templateVersion: '1',
        templateContentHash: 'synthetic-template-hash',
        ruleVersion: '1',
        ruleContentHash: 'synthetic-rule-hash',
        gameDataVersion: '3.2',
        evaluatedAt: timestamp,
        status: 'valid' as const,
        source: 'manual' as const,
        snapshot: { retainedEvidence: [10, 0, 30, 2] },
      },
      timestamp,
    ),
  )
  await db.accountScanImportBatches.put(
    scopeLegacyEntity(
      accountId,
      scanImportBatchMetaSchema.parse({
        id: 'growth-synthetic-batch',
        source: 'synthetic-test',
        createdAt: timestamp,
        updatedAt: timestamp,
        dataVersion: '3.2',
        recognitionVersion: 'synthetic-only',
        sourceReport: 'synthetic-evidence',
        total: 1,
      }),
      timestamp,
    ),
  )
  await db.accountScanImportItems.put(
    scopeLegacyEntity(
      accountId,
      scanImportItemSchema.parse({
        id: 'growth-synthetic-item',
        batchId: 'growth-synthetic-batch',
        sequence: 1,
        sourceIdentity: 'synthetic-stable-id',
        state: 'needs_review',
        fingerprint: 'synthetic-item-hash',
        lockState: 'unknown',
        candidate: {
          setId: null,
          setName: null,
          slot: null,
          level: null,
          rarity: null,
          mainStat: null,
          mainStatValue: null,
          subStats: [],
        },
        fields: {},
        issues: [
          {
            field: 'slot',
            code: 'synthetic_missing',
            message: 'Synthetic history',
            severity: 'review',
          },
        ],
        evidence: {
          detailPath: 'synthetic/detail',
          cardPath: 'synthetic/card',
          visualDetailHash: 'synthetic-visual',
          rawText: {},
        },
        updatedAt: timestamp,
      }),
      timestamp,
    ),
  )
  await db.accountOptimizationResults.put({
    scopedId: `${accountId}:growth-synthetic-result`,
    accountId,
    id: 'growth-synthetic-result',
    createdAt: timestamp,
    sourceLegacyId: null,
    result: {
      scenario: {
        id: 'growth-synthetic-scenario',
        rotationId: null,
        scope: 'account_global',
        gameVersion: '3.2',
        agentIds: teams.flat(),
        enemyIds: [],
        buffs: [],
        objective: 'template_score',
        discReuse: 'globally_unique',
        minimumTarget: null,
        fixedDiscIds: [],
        excludedDiscIds: [],
        lockedAgentIds: [],
        excludedAgentIds: [],
        lockedTeamIds: [],
        excludedTeamIds: [],
      },
      loadouts: [],
      teams: [],
      reachedTargets: 0,
      totalScore: 12,
      riskCount: 1,
      warnings: ['Synthetic historical result'],
      warehouseHash: 'synthetic-warehouse-hash',
      rosterHash: 'synthetic-roster-hash',
      dataVersion: '3.2',
      modelVersion: 'synthetic-only',
      elapsedMs: 1,
    },
  })
}

function accountDataFacts(backup: Awaited<ReturnType<typeof createAccountBackup>>) {
  return { ...backup.data, roster: rosterSnapshotFacts(backup.data.roster) }
}

describe('saved equipment growth account backup', () => {
  it('restores issued r2 frozen intent unchanged while rejecting altered parameters', async () => {
    const source = createDatabase()
    const target = createDatabase()
    await savedGrowthAccount(source, false)
    await seedAccount(target, 'account-unrelated-synthetic', 'Untouched synthetic account')
    const draft = (await source.accountPlanningDrafts.toArray())[0]!
    const intent = draft.teamPortfolioBuildIntent!
    const { fingerprint: currentFingerprint, ...unfingerprinted } = intent
    const historicalFingerprint = contentHash({
      ...unfingerprinted,
      discScoring: 'actual-disc-values-s-standard-r1',
      branchPolicy: 'explicit-branch-priority-shared-four-piece-once-r2',
    })
    expect(historicalFingerprint).not.toBe(currentFingerprint)
    const historicalIntent = { ...intent, fingerprint: historicalFingerprint }
    expect(buildIntentFingerprintMatches(historicalIntent)).toBe(false)
    await source.accountPlanningDrafts.put({ ...draft, teamPortfolioBuildIntent: historicalIntent })
    const backup = await createAccountBackup(accountId, source, exportTime)
    expect(preflightAccountBackup(backup)).toMatchObject({ success: true, errors: [] })
    await restoreAccountBackup(JSON.parse(JSON.stringify(backup)), target)
    const restored = await createAccountBackup(accountId, target, exportTime)
    expect(accountDataFacts(restored)).toEqual(accountDataFacts(backup))
    expect(restored.data.planningDrafts[0]!.teamPortfolioBuildIntent!.fingerprint).toBe(
      historicalFingerprint,
    )
    const altered = structuredClone(backup)
    altered.data.planningDrafts[0]!.teamPortfolioBuildIntent!.equipmentParametersByCandidateId![
      'backup-portfolio-candidate-1'
    ]!.wEngines[0]!.level = 30
    const before = await snapshotAccountState(target)
    const checked = preflightAccountBackup(altered)
    expect(checked.success).toBe(false)
    expect(checked.errors.join('; ')).toContain('指纹不匹配')
    await expect(restoreAccountBackup(altered, target)).rejects.toThrow()
    expect(await snapshotAccountState(target)).toEqual(before)
  })

  it.each([true, false])(
    'preserves all scoped data and 3.2 identities with explicit growth=%s',
    async (includeGrowth) => {
      const source = createDatabase()
      const target = createDatabase()
      await savedGrowthAccount(source, includeGrowth)
      await seedAccount(target, 'account-unrelated-synthetic', 'Unrelated synthetic account')
      const otherBefore = await createAccountBackup(
        'account-unrelated-synthetic',
        target,
        exportTime,
      )
      const sourceBefore = await snapshotAccountState(source)
      const backup = await createAccountBackup(accountId, source, exportTime)
      const exportedBefore = structuredClone(backup)
      const checked = preflightAccountBackup(backup)
      expect(checked, checked.errors.join('; ')).toMatchObject({ success: true, errors: [] })
      expect(checked.backup).toEqual(backup)
      expect(backup.counts).toEqual({
        driveDiscs: 37,
        discEvaluations: 1,
        scanBatches: 1,
        scanItems: 1,
        optimizationResults: 1,
        planningDrafts: 1,
        roster: 1,
        preferences: 1,
      })
      const draft = backup.data.planningDrafts[0]!
      expect(draft.solutionContext?.gameVersion).toBe('3.2')
      expect(draft.teamPortfolioSnapshot?.executions[0]?.memberIds).toEqual(teams[0])
      expect(draft.teamPortfolioBuildIntent?.agentPotentialById).toMatchObject({
        'agent-claret': 0,
        'agent-roxy': 0,
        'agent-koleda': 6,
        'agent-nekomata': 4,
      })
      const equipment =
        draft.teamPortfolioBuildIntent!.equipmentParametersByCandidateId![
          'backup-portfolio-candidate-1'
        ]!
      for (const [index, member] of draft.teamPortfolioSnapshot!.executions[0]!.members.entries()) {
        const engine = member.suggested.wEngine!
        if (includeGrowth) {
          const expected =
            index === 0
              ? { level: 10, ascension: 0 }
              : index === 1
                ? { level: 30, ascension: 2 }
                : { level: 60, ascension: 5 }
          expect(engine).toMatchObject(expected)
          expect(equipment.wEngines[index]).toMatchObject(expected)
        } else {
          expect(engine).not.toHaveProperty('level')
          expect(engine).not.toHaveProperty('ascension')
          expect(equipment.wEngines[index]).not.toHaveProperty('level')
          expect(equipment.wEngines[index]).not.toHaveProperty('ascension')
        }
      }
      expect(
        backup.data.roster!.agents.find((agent) => agent.agentId === 'agent-nekomata')
          ?.potentialImage,
      ).toBe(4)
      expect(
        backup.data.roster!.agents.find((agent) => agent.agentId === 'agent-claret')
          ?.potentialImage,
      ).toBe(0)
      await restoreAccountBackup(JSON.parse(JSON.stringify(backup)), target)
      const roundTrip = await createAccountBackup(accountId, target, exportTime)
      expect(preflightAccountBackup(roundTrip).success).toBe(true)
      expect(roundTrip.counts).toEqual(backup.counts)
      expect(roundTrip.dataPackRefs).toEqual(backup.dataPackRefs)
      expect(accountDataFacts(roundTrip)).toEqual(accountDataFacts(backup))
      expect(roundTrip.account).toEqual({ ...backup.account, source: 'backup_restore' })
      const otherAfter = await createAccountBackup(
        'account-unrelated-synthetic',
        target,
        exportTime,
      )
      expect({ ...otherAfter, data: accountDataFacts(otherAfter) }).toEqual({
        ...otherBefore,
        data: accountDataFacts(otherBefore),
      })
      expect(await snapshotAccountState(source)).toEqual(sourceBefore)
      expect(backup).toEqual(exportedBefore)
    },
  )

  it.each([
    ['level', 0],
    ['level', 61],
    ['ascension', -1],
    ['ascension', 6],
  ] as const)(
    'rejects out-of-range snapshot %s=%s before any account replacement',
    async (field, value) => {
      const source = createDatabase()
      const target = createDatabase()
      await savedGrowthAccount(source, true)
      await seedAccount(target, 'account-unrelated-synthetic', 'Untouched synthetic account')
      const backup = await createAccountBackup(accountId, source, exportTime)
      Reflect.set(
        backup.data.planningDrafts[0]!.teamPortfolioSnapshot!.executions[0]!.members[0]!.suggested
          .wEngine!,
        field,
        value,
      )
      const before = await snapshotAccountState(target)
      expect(preflightAccountBackup(backup).success).toBe(false)
      await expect(restoreAccountBackup(backup, target)).rejects.toThrow()
      expect(await snapshotAccountState(target)).toEqual(before)
    },
  )
})
