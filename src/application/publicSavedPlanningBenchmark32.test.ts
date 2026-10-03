import { createPlanningBenchmarkMetadata32Fixture } from '../testing/planningBenchmark32Fixture'
import { describe, expect, it } from 'vitest'
import { contentHash } from './contentHash'
import {
  planningEventDeclarations32Contract,
  planningEventDeclarationsInputFingerprint32,
  type PlanningEventDeclarationsInput32,
} from './publicPlanningEventDeclarations32'
import {
  planningBenchmark32Contract,
  planningBenchmarkResultFingerprint32,
  type PlanningBenchmarkResult32,
} from './publicPlanningBenchmark32'
import {
  createSavedPlanningBenchmark32,
  isSavedPlanningBenchmark32Current,
  savedPlanningBenchmark32Schema,
} from './publicSavedPlanningBenchmark32'
import { accountBackupSchema } from '../accounts/backupSchemas'
import Dexie from 'dexie'
import { SodaDatabase } from '../db/databaseCore'
import { createAccount, setActiveAccount, deleteAccountDriveDiscs } from '../accounts/repository'
import { createAccountBackup, restoreAccountBackup } from '../accounts/backup'
import { saveAccountPlanningDraft, getAccountPlanningDraft } from '../accounts/planningDrafts'
import { sampleDiscs } from '../evaluation/fixtures'
import { scopeLegacyEntity } from '../accounts/types'

function fixture() {
  const metadata = createPlanningBenchmarkMetadata32Fixture({
    ownerAgentId: 'agent-roxy',
    sourceRefs: ['source'],
  })
  const declarations: PlanningEventDeclarationsInput32 = {
    contract: planningEventDeclarations32Contract,
    sourceFingerprint: metadata.sourceFingerprint,
    confirmedDeclaredConditions: true,
    occurrences: [
      {
        occurrenceId: 'one',
        ownerAgentId: 'agent-roxy',
        eventId: 'hit',
        atSeconds: 0,
        windswept: 'inactive',
        conditions: [],
        sourceRefs: ['source'],
      },
    ],
  }
  const result: PlanningBenchmarkResult32 = {
    contract: planningBenchmark32Contract,
    runId: 'run',
    candidateId: 'candidate',
    fitFingerprint: 'fit',
    accountFingerprint: 'account',
    sourceBindingFingerprint: 'source-binding',
    metadata,
    inputFingerprint: planningEventDeclarationsInputFingerprint32(declarations),
    sideEffect: 'read_only',
    status: 'declared_event_benchmark',
    formalCycleReady: false,
    totalDamage: 400,
    benchmarkDps: 20,
    declaredDurationSeconds: 20,
    eventResults: [
      {
        occurrenceId: 'one',
        ownerAgentId: 'agent-roxy',
        eventId: 'hit',
        atSeconds: 0,
        snapshotAtSeconds: null,
        totalDamage: 400,
        runtimeHash: 'runtime',
        sourceRefs: ['source'],
      },
    ],
    includedEffectKeys: [],
    excludedEffects: [],
    gaps: [],
    missingContext: ['完整轮转未闭合'],
    resultFingerprint: '',
  }
  result.resultFingerprint = planningBenchmarkResultFingerprint32(result)
  return { declarations, result }
}
describe('saved declared benchmark32', () => {
  it('persists only on explicit save, restores backup unchanged, and retains disc protection after source staleness', async () => {
    const source = new SodaDatabase(`benchmark32-source-${crypto.randomUUID()}`)
    const target = new SodaDatabase(`benchmark32-target-${crypto.randomUUID()}`)
    try {
      const account = await createAccount('synthetic32', source)
      await setActiveAccount(account.id, source)
      const disc = sampleDiscs.treasureCandidate
      await source.accountDriveDiscs.put(
        scopeLegacyEntity(account.id, disc, '2026-10-01T00:00:00.000Z'),
      )
      const { result, declarations } = fixture()
      const snapshot = createSavedPlanningBenchmark32(result, declarations, result)
      expect(await source.accountPlanningDrafts.count()).toBe(0)
      const saved = await saveAccountPlanningDraft(
        account.id,
        {
          kind: 'team',
          name: 'synthetic',
          selection: { agentIds: ['agent-roxy'], bangbooId: null, scenario: 'synthetic' },
          manualOverrides: {
            wEngineDirection: '',
            discDirection: '',
            progressionDirection: '',
            notes: '',
          },
          knowledgeRefs: [],
          warehouseRefs: [disc.id],
          comparisonCapability: 'direction',
          planningBenchmark32: snapshot,
        },
        source,
      )
      const backup = await createAccountBackup(account.id, source)
      await restoreAccountBackup(JSON.parse(JSON.stringify(backup)), target)
      target.close()
      await target.open()
      expect(
        (await getAccountPlanningDraft(account.id, saved.id, target))?.planningBenchmark32,
      ).toEqual(snapshot)
      expect(
        isSavedPlanningBenchmark32Current(snapshot, {
          ...result,
          sourceBindingFingerprint: 'new-source',
        }),
      ).toBe(false)
      await expect(deleteAccountDriveDiscs(account.id, [disc.id], source)).rejects.toThrow(
        '已保存方案保护',
      )
      expect((await getAccountPlanningDraft(account.id, saved.id, source))?.warehouseRefs).toEqual([
        disc.id,
      ])
    } finally {
      for (const db of [source, target]) {
        db.close()
        await Dexie.delete(db.name)
      }
    }
  })
  it('keeps compact declarations and provenance through JSON readback without recalculation', () => {
    const { result, declarations } = fixture()
    const snapshot = createSavedPlanningBenchmark32(result, declarations, result)
    expect(snapshot).not.toHaveProperty('metadata')
    expect(savedPlanningBenchmark32Schema.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    )
    expect(isSavedPlanningBenchmark32Current(snapshot, result)).toBe(true)
    for (const key of [
      'runId',
      'candidateId',
      'fitFingerprint',
      'accountFingerprint',
      'inputFingerprint',
      'sourceBindingFingerprint',
    ] as const)
      expect(isSavedPlanningBenchmark32Current(snapshot, { ...result, [key]: 'changed' })).toBe(
        false,
      )
    expect(
      accountBackupSchema.shape.data.shape.planningDrafts
        .removeDefault()
        .element.shape.planningBenchmark32.parse(snapshot),
    ).toEqual(snapshot)
    expect(
      accountBackupSchema.shape.data.shape.planningDrafts
        .removeDefault()
        .element.shape.planningBenchmark32.parse(undefined),
    ).toBeUndefined()
  })
  it('rejects changed damage, condition and per-event attribution including resealed mismatches', () => {
    const { result, declarations } = fixture()
    const snapshot = createSavedPlanningBenchmark32(result, declarations, result)
    const edited = structuredClone(snapshot)
    edited.totalDamage = 401
    expect(savedPlanningBenchmark32Schema.safeParse(edited).success).toBe(false)
    edited.totalDamage = 400
    edited.declarations.occurrences[0]!.atSeconds = 4
    edited.inputFingerprint = planningEventDeclarationsInputFingerprint32(edited.declarations)
    const payload = { ...edited }
    Reflect.deleteProperty(payload, 'snapshotFingerprint')
    edited.snapshotFingerprint = contentHash(payload)
    expect(savedPlanningBenchmark32Schema.safeParse(edited).success).toBe(false)
    expect(() =>
      createSavedPlanningBenchmark32(
        result,
        { ...declarations, confirmedDeclaredConditions: false },
        result,
      ),
    ).toThrow()
  })
})
