import { assessScanImportItem, normalizeCandidate } from './scanImportAssessment'
import type { ScanImportAssessmentContext } from './scanImportAssessment'
export { assessScanImportItem, type ScanImportAssessmentContext } from './scanImportAssessment'
import {
  legacyScanImportExpectedTotal,
  scanBatchManifestV2Schema,
  scanBatchManifestSchema,
  scanReviewSnapshotSchema,
} from './scanImportStagingSchemas'
import type {
  ScanBatchManifest,
  ScanImportItem,
  ScanImportBatchMeta,
  ScanImportReviewPatch,
  ScanImportBatchMatch,
} from './scanImportStagingSchemas'
export * from './scanImportStagingSchemas'
import { z } from 'zod'
import { contentHash } from '../application/contentHash'
import type { StatKey } from './schemas'
export { summarizeScanImportItems } from './scanImportSummary'

export function isLegacyScanImportBatch(
  batch: Pick<ScanImportBatchMeta, 'manifest' | 'total' | 'recognitionVersion'>,
) {
  return (
    !batch.manifest &&
    batch.total === legacyScanImportExpectedTotal &&
    /paddle/i.test(batch.recognitionVersion)
  )
}

type ScanManifestBatchIdentity = Pick<
  ScanImportBatchMeta,
  'id' | 'source' | 'createdAt' | 'dataVersion' | 'recognitionVersion' | 'sourceReport' | 'total'
>

function scanPayloadIdentityV1(items: ScanImportItem[]) {
  return items
    .map((item) => ({
      id: item.id,
      batchId: item.batchId,
      sequence: item.sequence,
      sourceIdentity: item.sourceIdentity,
      fingerprint: item.fingerprint,
      detailPath: item.evidence.detailPath,
      cardPath: item.evidence.cardPath,
      visualDetailHash: item.evidence.visualDetailHash,
    }))
    .toSorted((left, right) => left.sequence - right.sequence)
}

function scanPayloadIdentityV2(items: ScanImportItem[]) {
  return items
    .map((item) => ({
      id: item.id,
      batchId: item.batchId,
      sequence: item.sequence,
      sourceIdentity: item.sourceIdentity,
      duplicate: item.duplicate,
      fingerprint: item.fingerprint,
      lockState: item.lockState,
      candidate: item.candidate,
      fields: item.fields,
      confirmations: item.confirmations,
      issues: item.issues,
      state: item.state,
      evidence: item.evidence,
    }))
    .toSorted((left, right) => left.sequence - right.sequence)
}

function scanSourceIdentity(
  batch: ScanManifestBatchIdentity,
  manifest: Pick<
    ScanBatchManifest,
    'gameVersion' | 'scanConfigIdentity' | 'viewport' | 'legacyAdapter'
  >,
) {
  return {
    id: batch.id,
    source: batch.source,
    createdAt: batch.createdAt,
    dataVersion: batch.dataVersion,
    recognitionVersion: batch.recognitionVersion,
    sourceReport: batch.sourceReport,
    total: batch.total,
    gameVersion: manifest.gameVersion,
    scanConfigIdentity: manifest.scanConfigIdentity,
    viewport: manifest.viewport,
    legacyAdapter: manifest.legacyAdapter ?? null,
  }
}

export function createScanBatchManifest(
  batch: ScanManifestBatchIdentity,
  items: ScanImportItem[],
  input: {
    expectedTotal: number
    gameVersion: string
    scanConfigIdentity: string
    viewport?: string | null
    legacyAdapter?: 'legacy-343-v1'
  },
): ScanBatchManifest {
  const uniqueItemCount = new Set(items.map((item) => item.sourceIdentity)).size
  const identity = {
    gameVersion: input.gameVersion,
    scanConfigIdentity: input.scanConfigIdentity,
    viewport: input.viewport ?? null,
    legacyAdapter: input.legacyAdapter,
  }
  return scanBatchManifestSchema.parse({
    schemaVersion: 2,
    batchId: batch.id,
    expectedTotal: input.expectedTotal,
    capturedTotal: items.length,
    uniqueItemCount,
    ...identity,
    payloadHash: contentHash(scanPayloadIdentityV2(items)),
    sourceHash: contentHash(scanSourceIdentity(batch, identity)),
  })
}

export function resolveScanBatchManifest(
  batch: ScanImportBatchMeta,
  items: ScanImportItem[],
  options: { allowLegacy343?: boolean; allowManifestV1ReadOnly?: boolean } = {},
): { manifest: ScanBatchManifest; legacy: boolean } {
  const manifest =
    batch.manifest ??
    (options.allowLegacy343 &&
    isLegacyScanImportBatch(batch) &&
    items.length === legacyScanImportExpectedTotal &&
    new Set(items.map((item) => item.sourceIdentity)).size === legacyScanImportExpectedTotal
      ? createScanBatchManifest(batch, items, {
          expectedTotal: legacyScanImportExpectedTotal,
          gameVersion: batch.dataVersion,
          scanConfigIdentity: 'legacy-343-v1',
          legacyAdapter: 'legacy-343-v1',
        })
      : null)
  if (!manifest) throw new Error('扫描批次缺少版本化 manifest，不能推断预期总数。')
  const parsed = scanBatchManifestSchema.parse(manifest)
  if (parsed.schemaVersion === 1 && !options.allowManifestV1ReadOnly)
    throw new Error('扫描批次 manifest v1 仅允许显式只读审计，不能进入正式暂存或导入。')
  if (parsed.batchId !== batch.id) throw new Error('扫描批次 manifest 的 batchId 不一致。')
  if (batch.total !== parsed.expectedTotal)
    throw new Error('扫描批次声明数量与 manifest 预期总数不一致。')
  if (items.length !== parsed.capturedTotal || parsed.capturedTotal !== parsed.expectedTotal)
    throw new Error(`扫描批次捕获数量 ${items.length} 与预期 ${parsed.expectedTotal} 不一致。`)
  const uniqueItemCount = new Set(items.map((item) => item.sourceIdentity)).size
  if (uniqueItemCount !== parsed.uniqueItemCount || uniqueItemCount !== parsed.expectedTotal)
    throw new Error('扫描批次包含重复稳定身份或唯一记录数量不完整。')
  if (items.some((item) => item.batchId !== batch.id)) throw new Error('扫描暂存项批次 ID 不一致。')
  const payloadIdentity =
    parsed.schemaVersion === 2 ? scanPayloadIdentityV2(items) : scanPayloadIdentityV1(items)
  if (parsed.payloadHash !== contentHash(payloadIdentity))
    throw new Error('扫描批次 payloadHash 校验失败。')
  if (parsed.sourceHash !== contentHash(scanSourceIdentity(batch, parsed)))
    throw new Error('扫描批次 sourceHash 校验失败。')
  return { manifest: parsed, legacy: parsed.legacyAdapter === 'legacy-343-v1' }
}

export function refreshScanBatchManifestPayloadHash(
  batch: ScanImportBatchMeta,
  items: ScanImportItem[],
) {
  const manifest = scanBatchManifestV2Schema.parse(batch.manifest)
  if (manifest.sourceHash !== contentHash(scanSourceIdentity(batch, manifest)))
    throw new Error('扫描批次 sourceHash 校验失败。')
  if (items.length !== manifest.expectedTotal)
    throw new Error('扫描批次复核内容数量与 manifest 预期总数不一致。')
  if (
    items.some((item) => item.batchId !== batch.id) ||
    new Set(items.map((item) => item.sourceIdentity)).size !== manifest.expectedTotal
  )
    throw new Error('扫描批次复核内容身份不完整。')
  return scanBatchManifestV2Schema.parse({
    ...manifest,
    payloadHash: contentHash(scanPayloadIdentityV2(items)),
  })
}

function confirmedFieldNames(candidate: ScanImportItem['candidate']) {
  return [
    'setName',
    'slot',
    'level',
    'mainStat',
    'lockState',
    ...candidate.subStats.map((_, index) => `subStats.${index}`),
  ]
}

function markUserConfirmedFields(
  item: ScanImportItem,
  patch: ScanImportReviewPatch,
  confirmedAt: string,
  confirmedFields = confirmedFieldNames(patch.candidate),
) {
  const fields = { ...item.fields }
  const values: Record<string, unknown> = {
    setName: patch.candidate.setName,
    slot: patch.candidate.slot,
    level: patch.candidate.level,
    mainStat: patch.candidate.mainStat,
    lockState: patch.lockState,
  }
  patch.candidate.subStats.forEach((subStat, index) => {
    values[`subStats.${index}`] = {
      stat: subStat.stat,
      value: subStat.value,
      upgrades: subStat.upgrades,
    }
  })
  for (const [field, value] of Object.entries(values)) {
    if (!confirmedFields.includes(field)) continue
    const previous = fields[field]
    fields[field] = {
      rawText: previous?.rawText ?? '',
      normalizedValue: value,
      confidence: 'high',
      evidence: [
        ...(previous?.evidence ?? []),
        `user-confirmed-at=${confirmedAt}`,
        `previous-confidence=${previous?.confidence ?? 'missing'}`,
        `previous-normalized=${JSON.stringify(previous?.normalizedValue ?? null)}`,
        `previous-rule=${previous?.rule ?? 'missing'}`,
        `previous-source=${previous?.source ?? 'missing'}`,
      ],
      rule: 'user_confirmed',
      source: 'user-review',
    }
  }
  return fields
}

function reviewFieldValue(snapshot: z.infer<typeof scanReviewSnapshotSchema>, field: string) {
  if (field === 'setName')
    return { setId: snapshot.candidate.setId, setName: snapshot.candidate.setName }
  if (field === 'slot') return snapshot.candidate.slot
  if (field === 'level') return snapshot.candidate.level
  if (field === 'mainStat') return snapshot.candidate.mainStat
  if (field === 'lockState') return snapshot.lockState
  const subStatIndex = field.match(/^subStats\.(\d+)$/)?.[1]
  if (subStatIndex === undefined) return undefined
  const subStat = snapshot.candidate.subStats[Number(subStatIndex)]
  return subStat
    ? { stat: subStat.stat, value: subStat.value, upgrades: subStat.upgrades }
    : undefined
}

function applyConfirmedReviewFields(
  target: ScanImportItem,
  sourceAfter: z.infer<typeof scanReviewSnapshotSchema>,
  fields: string[],
) {
  const candidate = structuredClone(target.candidate)
  let lockState = target.lockState
  for (const field of fields) {
    if (field === 'setName') {
      candidate.setId = sourceAfter.candidate.setId
      candidate.setName = sourceAfter.candidate.setName
    } else if (field === 'slot') candidate.slot = sourceAfter.candidate.slot
    else if (field === 'level') candidate.level = sourceAfter.candidate.level
    else if (field === 'mainStat') candidate.mainStat = sourceAfter.candidate.mainStat
    else if (field === 'lockState') lockState = sourceAfter.lockState
    else {
      const subStatIndex = field.match(/^subStats\.(\d+)$/)?.[1]
      if (subStatIndex === undefined) continue
      const sourceSubStat = sourceAfter.candidate.subStats[Number(subStatIndex)]
      if (sourceSubStat)
        candidate.subStats[Number(subStatIndex)] = { ...sourceSubStat, confidence: 'high' }
    }
  }
  return { candidate: normalizeCandidate(candidate), lockState }
}

export function confirmScanImportItem(
  input: ScanImportItem,
  patch: ScanImportReviewPatch,
  context: ScanImportAssessmentContext,
  confirmedAt = new Date().toISOString(),
) {
  const fields = patch.fields ?? confirmedFieldNames(patch.candidate)
  const confirmedCandidate = normalizeCandidate({
    ...patch.candidate,
    subStats: patch.candidate.subStats.map((subStat) => ({
      ...subStat,
      confidence: 'high' as const,
    })),
  })
  const confirmation = {
    contract: 'user_confirmed.v1' as const,
    confirmedAt,
    source: 'user' as const,
    fields,
    before: { candidate: input.candidate, lockState: input.lockState },
    after: { candidate: confirmedCandidate, lockState: patch.lockState },
  }
  return assessScanImportItem(
    {
      ...input,
      candidate: confirmedCandidate,
      lockState: patch.lockState,
      fields: markUserConfirmedFields(
        input,
        { candidate: confirmedCandidate, lockState: patch.lockState },
        confirmedAt,
        fields,
      ),
      confirmations: [...(input.confirmations ?? []), confirmation],
      updatedAt: confirmedAt,
    },
    context,
  )
}

export function migrateConfirmedScanImportItem(
  target: ScanImportItem,
  source: ScanImportItem,
  sourceConfirmation: ScanImportItem['confirmations'][number],
  match: ScanImportBatchMatch,
  context: ScanImportAssessmentContext,
  confirmedAt = new Date().toISOString(),
) {
  if (
    JSON.stringify(source.candidate) !== JSON.stringify(sourceConfirmation.after.candidate) ||
    source.lockState !== sourceConfirmation.after.lockState
  )
    throw new Error('来源人工确认与当前暂存值不一致，不能安全跨批次迁移。')

  if (!sourceConfirmation.fields.length) throw new Error('来源人工确认没有可迁移字段。')
  const targetBefore = { candidate: target.candidate, lockState: target.lockState }
  for (const field of sourceConfirmation.fields) {
    const evidence = target.fields[field]
    const targetValue = reviewFieldValue(targetBefore, field)
    const sourceValue = reviewFieldValue(sourceConfirmation.after, field)
    if (
      evidence?.confidence === 'high' &&
      evidence.normalizedValue !== null &&
      JSON.stringify(targetValue) !== JSON.stringify(sourceValue)
    )
      throw new Error(`${field} 与新批次高置信值冲突。`)
  }
  const patch = applyConfirmedReviewFields(
    target,
    sourceConfirmation.after,
    sourceConfirmation.fields,
  )
  const migrated = assessScanImportItem(
    {
      ...target,
      candidate: patch.candidate,
      lockState: patch.lockState,
      fields: markUserConfirmedFields(target, patch, confirmedAt, sourceConfirmation.fields),
      confirmations: [
        ...(target.confirmations ?? []),
        {
          contract: 'user_confirmed.v1',
          confirmedAt,
          source: 'cross_batch_migration',
          fields: sourceConfirmation.fields,
          before: sourceConfirmation.before,
          after: patch,
          migration: {
            sourceBatchId: source.batchId,
            sourceItemId: source.id,
            sourceConfirmationAt: sourceConfirmation.confirmedAt,
            matchMethod: match.matchMethod,
            matchConfidence: match.matchConfidence,
            targetBefore,
            sourceFieldEvidence: Object.fromEntries(
              sourceConfirmation.fields.flatMap((field) =>
                source.fields[field] ? [[field, source.fields[field]]] : [],
              ),
            ),
          },
        },
      ],
      updatedAt: confirmedAt,
    },
    context,
  )
  if (migrated.state !== 'ready')
    throw new Error(`迁移后仍有领域问题：${migrated.issues.map((item) => item.message).join('；')}`)
  return migrated
}

function legacyConfirmedAt(item: ScanImportItem, fields: string[]) {
  for (const field of fields) {
    const marker = item.fields[field]?.evidence.find((entry) => entry.startsWith('manual-review='))
    if (marker) return marker.slice('manual-review='.length)
  }
  return item.updatedAt
}

export function reassessSavedScanImportItem(
  input: ScanImportItem,
  context: ScanImportAssessmentContext,
) {
  const legacyFields = Object.keys(input.fields).filter(
    (field) =>
      input.fields[field]?.rule === 'manual_review_confirmation' ||
      input.fields[field]?.source === 'user-review',
  )
  if (!legacyFields.length) return assessScanImportItem(input, context)
  const candidate = normalizeCandidate({
    ...input.candidate,
    subStats: input.candidate.subStats.map((subStat, index) => ({
      ...subStat,
      confidence: legacyFields.includes(`subStats.${index}`)
        ? ('high' as const)
        : subStat.confidence,
    })),
  })
  const hasConfirmationAudit = (input.confirmations ?? []).some(
    (confirmation) => confirmation.contract === 'user_confirmed.v1',
  )
  const confirmedAt = legacyConfirmedAt(input, legacyFields)
  return assessScanImportItem(
    {
      ...input,
      candidate,
      confirmations: hasConfirmationAudit
        ? input.confirmations
        : [
            ...(input.confirmations ?? []),
            {
              contract: 'user_confirmed.v1',
              confirmedAt,
              source: 'legacy_migration',
              fields: legacyFields,
              before: null,
              after: { candidate, lockState: input.lockState },
            },
          ],
    },
    context,
  )
}

export function createStandardImportFromStaging(
  batch: ScanImportBatchMeta,
  items: ScanImportItem[],
) {
  const ready = items.filter((item) => item.state === 'ready')
  return {
    format: 'soda-terminal-drive-disc-import',
    formatVersion: 1,
    source: {
      adapter: 'soda-terminal-scan-staging',
      sourceFile: batch.sourceReport,
      capturedAt: batch.createdAt,
      detailPanel: { resolution: batch.manifest?.viewport ?? undefined, region: 'DETAIL' },
    },
    batch: { id: batch.id, note: `识别版本 ${batch.recognitionVersion}` },
    discs: ready.map((item) => ({
      setId: item.candidate.setId as string,
      setName: item.candidate.setName as string,
      slot: item.candidate.slot as 1 | 2 | 3 | 4 | 5 | 6,
      level: item.candidate.level as number,
      rarity: item.candidate.rarity as 'A' | 'S',
      mainStat: item.candidate.mainStat as StatKey,
      subStats: item.candidate.subStats.map((subStat) => ({
        stat: subStat.stat as StatKey,
        value: subStat.value as number,
        upgrades: subStat.upgrades as number,
      })),
      // Locking is a game-local player action, not Soda product data. Retained R4 evidence
      // remains auditable, while imported assets always use the neutral local value.
      locked: false,
      sourceId: item.sourceIdentity,
    })),
  }
}
