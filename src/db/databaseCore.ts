import Dexie, { type EntityTable } from 'dexie'
import { normalizeDiscTags } from '../domain/discTags'
import type { BuildProfile, DiscEvaluation, DriveDisc } from '../domain/schemas'
import type { EvaluationSnapshot } from '../evaluation/types'
import type { ScanImportBatchMeta, ScanImportItem } from '../domain/scanImportStaging'
import {
  legacyActiveDevelopmentPlansKey,
  legacyPlanningSolutionContext,
} from '../accounts/planningSolutionContext'
import type {
  AccountDiscEvaluation,
  AccountDriveDisc,
  AccountOptimizationResult,
  AccountPlanningDraft,
  AccountPreference,
  AccountProfile,
  AccountRosterRecord,
  AccountScanImportBatch,
  AccountScanImportItem,
} from '../accounts/types'
import type { GameDataPackageManifest, GameDataPackState } from '../gameDataPacks/types'
import { getLegacyDriveDiscVersion, migrateLegacyDiscEvaluation } from './legacyEvaluationMigration'

export type Setting = { key: string; value: unknown }

export const databaseSchemaVersion = 9

export class SodaDatabase extends Dexie {
  driveDiscs!: EntityTable<DriveDisc, 'id'>
  discEvaluations!: EntityTable<DiscEvaluation, 'id'>
  buildProfiles!: EntityTable<BuildProfile, 'id'>
  settings!: EntityTable<Setting, 'key'>
  scanImportBatches!: EntityTable<ScanImportBatchMeta, 'id'>
  scanImportItems!: EntityTable<ScanImportItem, 'id'>
  accounts!: EntityTable<AccountProfile, 'id'>
  accountDriveDiscs!: EntityTable<AccountDriveDisc, 'scopedId'>
  accountDiscEvaluations!: EntityTable<AccountDiscEvaluation, 'scopedId'>
  accountScanImportBatches!: EntityTable<AccountScanImportBatch, 'scopedId'>
  accountScanImportItems!: EntityTable<AccountScanImportItem, 'scopedId'>
  accountRosters!: EntityTable<AccountRosterRecord, 'accountId'>
  accountOptimizationResults!: EntityTable<AccountOptimizationResult, 'scopedId'>
  accountPlanningDrafts!: EntityTable<AccountPlanningDraft, 'scopedId'>
  accountPreferences!: EntityTable<AccountPreference, 'scopedId'>
  gameDataPacks!: EntityTable<GameDataPackageManifest, 'id'>
  gameDataPackState!: EntityTable<GameDataPackState, 'id'>

  constructor(name = 'soda-terminal') {
    super(name)
    this.version(1).stores({
      driveDiscs: 'id, setId, slot, level, locked, favorite, updatedAt',
      buildProfiles: 'id, agentId, role, isDefault, version',
      settings: 'key',
    })
    this.version(2)
      .stores({
        driveDiscs: 'id, setId, slot, level, locked, favorite, updatedAt',
        discEvaluations: 'id, discId, [discId+evaluatedAt], status, evaluatedAt, templateId',
        buildProfiles: 'id, agentId, role, isDefault, version',
        settings: 'key',
      })
      .upgrade(async (transaction) => {
        const driveDiscs = transaction.table<DriveDisc, string>('driveDiscs')
        const discEvaluations = transaction.table<DiscEvaluation, string>('discEvaluations')
        const legacyDiscs = await driveDiscs.toArray()

        for (const legacyDisc of legacyDiscs) {
          const current = legacyDisc.evaluationSnapshot as EvaluationSnapshot | undefined
          const previous = legacyDisc.previousEvaluationSnapshot as EvaluationSnapshot | undefined
          for (const snapshot of [previous, current]) {
            if (!snapshot?.input) continue
            const versionInput = { ...snapshot.input, id: legacyDisc.id }
            const evaluation = migrateLegacyDiscEvaluation(versionInput, snapshot)
            await discEvaluations.put(evaluation)
          }

          const migratedDisc = {
            ...legacyDisc,
            discVersion: getLegacyDriveDiscVersion(legacyDisc),
          } as DriveDisc & Record<string, unknown>
          delete migratedDisc.evaluationSnapshot
          delete migratedDisc.previousEvaluationSnapshot
          await driveDiscs.put(migratedDisc)
        }
      })
    this.version(3)
      .stores({
        driveDiscs: 'id, setId, slot, level, locked, favorite, *tags, updatedAt',
        discEvaluations: 'id, discId, [discId+evaluatedAt], status, evaluatedAt, templateId',
        buildProfiles: 'id, agentId, role, isDefault, version',
        settings: 'key',
      })
      .upgrade(async (transaction) => {
        const driveDiscs = transaction.table<DriveDisc, string>('driveDiscs')
        await driveDiscs.toCollection().modify((disc) => {
          disc.tags = normalizeDiscTags(disc.tags ?? [])
        })
      })
    this.version(6)
      .stores({
        driveDiscs: 'id, setId, slot, level, locked, favorite, *tags, updatedAt',
        discEvaluations: 'id, discId, [discId+evaluatedAt], status, evaluatedAt, templateId',
        buildProfiles: 'id, agentId, role, isDefault, sourceTemplateId, archived, version',
        settings: 'key',
        scanImportBatches: 'id, updatedAt, dataVersion',
        scanImportItems: 'id, batchId, [batchId+state], state, fingerprint, sourceIdentity',
        accounts: 'id, isDefault, status, updatedAt',
        accountDriveDiscs:
          'scopedId, accountId, [accountId+id], [accountId+slot], [accountId+setId], updatedAt',
        accountDiscEvaluations:
          'scopedId, accountId, [accountId+discId], [accountId+status], evaluatedAt',
        accountScanImportBatches: 'scopedId, accountId, [accountId+id], updatedAt, dataVersion',
        accountScanImportItems:
          'scopedId, accountId, [accountId+batchId], [accountId+state], fingerprint, sourceIdentity',
        accountRosters: 'accountId, updatedAt',
        accountOptimizationResults: 'scopedId, accountId, [accountId+id], createdAt',
        accountPreferences: 'scopedId, accountId, [accountId+key], updatedAt',
      })
      .upgrade(async (transaction) => {
        const profiles = transaction.table<BuildProfile, string>('buildProfiles')
        await profiles.toCollection().modify((profile) => {
          profile.sourceTemplateId ??= null
          profile.archived ??= false
          profile.createdAt ??= profile.updatedAt ?? new Date().toISOString()
          profile.updatedAt ??= profile.createdAt
        })
      })
    this.version(7).stores({
      driveDiscs: 'id, setId, slot, level, locked, favorite, *tags, updatedAt',
      discEvaluations: 'id, discId, [discId+evaluatedAt], status, evaluatedAt, templateId',
      buildProfiles: 'id, agentId, role, isDefault, sourceTemplateId, archived, version',
      settings: 'key',
      scanImportBatches: 'id, updatedAt, dataVersion',
      scanImportItems: 'id, batchId, [batchId+state], state, fingerprint, sourceIdentity',
      accounts: 'id, isDefault, status, updatedAt',
      accountDriveDiscs:
        'scopedId, accountId, [accountId+id], [accountId+slot], [accountId+setId], updatedAt',
      accountDiscEvaluations:
        'scopedId, accountId, [accountId+discId], [accountId+status], evaluatedAt',
      accountScanImportBatches: 'scopedId, accountId, [accountId+id], updatedAt, dataVersion',
      accountScanImportItems:
        'scopedId, accountId, [accountId+batchId], [accountId+state], fingerprint, sourceIdentity',
      accountRosters: 'accountId, updatedAt',
      accountOptimizationResults: 'scopedId, accountId, [accountId+id], createdAt',
      accountPreferences: 'scopedId, accountId, [accountId+key], updatedAt',
      gameDataPacks: 'id, kind, gameVersion, status, publishedAt',
      gameDataPackState: 'id, updatedAt',
    })
    this.version(8).stores({
      driveDiscs: 'id, setId, slot, level, locked, favorite, *tags, updatedAt',
      discEvaluations: 'id, discId, [discId+evaluatedAt], status, evaluatedAt, templateId',
      buildProfiles: 'id, agentId, role, isDefault, sourceTemplateId, archived, version',
      settings: 'key',
      scanImportBatches: 'id, updatedAt, dataVersion',
      scanImportItems: 'id, batchId, [batchId+state], state, fingerprint, sourceIdentity',
      accounts: 'id, isDefault, status, updatedAt',
      accountDriveDiscs:
        'scopedId, accountId, [accountId+id], [accountId+slot], [accountId+setId], updatedAt',
      accountDiscEvaluations:
        'scopedId, accountId, [accountId+discId], [accountId+status], evaluatedAt',
      accountScanImportBatches: 'scopedId, accountId, [accountId+id], updatedAt, dataVersion',
      accountScanImportItems:
        'scopedId, accountId, [accountId+batchId], [accountId+state], fingerprint, sourceIdentity',
      accountRosters: 'accountId, updatedAt',
      accountOptimizationResults: 'scopedId, accountId, [accountId+id], createdAt',
      accountPlanningDrafts: 'scopedId, accountId, [accountId+id], [accountId+kind], updatedAt',
      accountPreferences: 'scopedId, accountId, [accountId+key], updatedAt',
      gameDataPacks: 'id, kind, gameVersion, status, publishedAt',
      gameDataPackState: 'id, updatedAt',
    })
    this.version(9)
      .stores({
        driveDiscs: 'id, setId, slot, level, locked, favorite, *tags, updatedAt',
        discEvaluations: 'id, discId, [discId+evaluatedAt], status, evaluatedAt, templateId',
        buildProfiles: 'id, agentId, role, isDefault, sourceTemplateId, archived, version',
        settings: 'key',
        scanImportBatches: 'id, updatedAt, dataVersion',
        scanImportItems: 'id, batchId, [batchId+state], state, fingerprint, sourceIdentity',
        accounts: 'id, isDefault, status, updatedAt',
        accountDriveDiscs:
          'scopedId, accountId, [accountId+id], [accountId+slot], [accountId+setId], updatedAt',
        accountDiscEvaluations:
          'scopedId, accountId, [accountId+discId], [accountId+status], evaluatedAt',
        accountScanImportBatches: 'scopedId, accountId, [accountId+id], updatedAt, dataVersion',
        accountScanImportItems:
          'scopedId, accountId, [accountId+batchId], [accountId+state], state, fingerprint, sourceIdentity',
        accountRosters: 'accountId, updatedAt',
        accountOptimizationResults: 'scopedId, accountId, [accountId+id], createdAt',
        accountPlanningDrafts: 'scopedId, accountId, [accountId+id], [accountId+kind], updatedAt',
        accountPreferences: 'scopedId, accountId, [accountId+key], updatedAt',
        gameDataPacks: 'id, kind, gameVersion, status, publishedAt',
        gameDataPackState: 'id, updatedAt',
      })
      .upgrade(async (transaction) => {
        const drafts = transaction.table<AccountPlanningDraft, string>('accountPlanningDrafts')
        const preferences = transaction.table<AccountPreference, string>('accountPreferences')
        const legacyActiveByAccount = new Map<string, Record<string, string>>()
        for (const preference of (await preferences.toArray()).filter(
          (item) => item.key === legacyActiveDevelopmentPlansKey,
        )) {
          const value = preference.value
          if (!value || typeof value !== 'object' || Array.isArray(value)) continue
          legacyActiveByAccount.set(
            preference.accountId,
            Object.fromEntries(
              Object.entries(value).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string',
              ),
            ),
          )
        }

        const rows = await drafts.toArray()
        const groupedAgentRows = new Map<string, AccountPlanningDraft[]>()
        for (const draft of rows) {
          if (draft.kind !== 'agent' || draft.selection.agentIds.length !== 1) continue
          const key = `${draft.accountId}::${draft.selection.agentIds[0]}`
          groupedAgentRows.set(key, [...(groupedAgentRows.get(key) ?? []), draft])
        }
        const currentAgentPlanIds = new Set<string>()
        for (const [key, agentRows] of groupedAgentRows) {
          const [accountId, agentId] = key.split('::')
          const legacyActiveId = legacyActiveByAccount.get(accountId)?.[agentId]
          const selected =
            agentRows.find((draft) => draft.id === legacyActiveId) ??
            agentRows
              .filter((draft) => /方案\s*A(?:\b|$)/iu.test(draft.name))
              .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
          if (selected) currentAgentPlanIds.add(selected.scopedId)
        }

        for (const draft of rows) {
          await drafts.put({
            ...draft,
            ...(draft.kind === 'agent'
              ? {
                  savedRole: currentAgentPlanIds.has(draft.scopedId)
                    ? ('current_reference' as const)
                    : ('history' as const),
                }
              : {}),
            solutionContext: draft.solutionContext ?? legacyPlanningSolutionContext(draft),
          })
        }
      })
  }
}

export const database = new SodaDatabase()
