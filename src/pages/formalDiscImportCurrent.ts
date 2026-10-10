import { getPublicFormalImportActiveAccount } from '../application/publicFormalImportAccount'
import { database } from '../db/databaseCore'
import {
  isLegacyScanImportBatch,
  resolveScanBatchManifest,
  summarizeScanImportItems,
} from '../domain/scanImportStaging'
import {
  createScannerTargetAccountBinding,
  readScannerTargetAccountBinding,
  validateScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import {
  activeScannerResultBatchSettingKey,
  scanResultHandleSettingKey,
} from '../scanner/resultHandoff'
import { hasCompletedFormalImportProof } from './formalDiscImportProof'
export async function loadFormalImportCurrent(successSampleMode: boolean) {
  if (successSampleMode) return null
  const bindingResult = readScannerTargetAccountBinding()
  if (!bindingResult.valid && bindingResult.code !== 'binding_missing')
    return { bindingError: bindingResult.message }
  const activeAccount = await getPublicFormalImportActiveAccount(database)
  const account = bindingResult.valid
    ? await database.accounts.get(bindingResult.binding.accountId)
    : activeAccount
  const discs = account
    ? await database.accountDriveDiscs.where('accountId').equals(account.id).count()
    : 0
  if (bindingResult.valid) {
    const bindingValidation = validateScannerTargetAccountBinding({
      binding: bindingResult.binding,
      targetAccount: account ?? null,
      activeAccount: activeAccount ?? null,
      currentDiscCount: discs,
    })
    if (!bindingValidation.valid) return { bindingError: bindingValidation.message }
  }
  if (!account) return { bindingError: '扫描目标账户已不存在，请返回扫描页重新确认。' }
  const batches = await database.accountScanImportBatches
    .where('accountId')
    .equals(account.id)
    .toArray()
  const eligibleBatches = batches
    .filter(
      (entry) =>
        /paddle/i.test(entry.recognitionVersion) &&
        Boolean(entry.manifest || isLegacyScanImportBatch(entry)),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const activeResultSetting = await database.settings.get(
    activeScannerResultBatchSettingKey(account.id),
  )
  const activeBatchId =
    typeof activeResultSetting?.value === 'string' ? activeResultSetting.value : null
  const batch = activeBatchId
    ? (eligibleBatches.find((entry) => entry.id === activeBatchId) ?? null)
    : (eligibleBatches[0] ?? null)
  if (activeBatchId && !batch)
    return { bindingError: '这次扫描结果已不可用，请返回扫描页重新读取。' }
  const items = batch
    ? await database.accountScanImportItems
        .where('[accountId+batchId]')
        .equals([account.id, batch.id])
        .toArray()
    : []
  if (batch?.manifest?.schemaVersion === 1)
    return { bindingError: '这份扫描结果来自旧版画面扫描，请返回扫描页重新扫描。' }
  if (batch?.manifest?.schemaVersion === 2) {
    try {
      resolveScanBatchManifest(batch, items)
    } catch {
      return { bindingError: '这份扫描结果不完整，无法继续导入，请重新扫描。' }
    }
  }
  const summary = summarizeScanImportItems(items)
  const resultHandleSetting = batch
    ? await database.settings.get(scanResultHandleSettingKey(account.id, batch.id))
    : null
  if (!bindingResult.valid) {
    const expectedTotal =
      batch?.manifest?.expectedTotal ??
      (batch && isLegacyScanImportBatch(batch) ? batch.total : null)
    const importedAudit = (batch?.importHistory ?? [])
      .filter((event) => event.action === 'imported')
      .at(-1)
    if (
      !hasCompletedFormalImportProof({
        expectedTotal,
        itemCount: items.length,
        importedCount: summary.imported,
        formalDiscCount: discs,
        auditImportedCount: importedAudit?.importedCount,
        auditSkippedCount: importedAudit?.skippedCount,
      })
    )
      return { bindingError: bindingResult.message }
  }
  return {
    account,
    binding: bindingResult.valid
      ? bindingResult.binding
      : createScannerTargetAccountBinding({ account, baselineDiscCount: discs }),
    discs,
    batch: batch ?? null,
    items,
    summary,
    resultFileHandle:
      typeof resultHandleSetting?.value === 'string' ? resultHandleSetting.value : null,
  }
}
export type FormalImportCurrent = Awaited<ReturnType<typeof loadFormalImportCurrent>>
export type LoadedFormalImportCurrent = Extract<FormalImportCurrent, { account: object }>
