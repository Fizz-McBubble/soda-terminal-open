import {
  reviewAccountScanImportItem,
  preflightAccountScanReviewBatch,
} from '../db/accountScanImport'
import { database } from '../db/databaseCore'
import { getScanCalibrationFields, isScanCalibrationField } from '../domain/scanManualCalibration'
import { scanReviewSnapshotSchema, type ScanImportItem } from '../domain/scanImportStaging'
import {
  getCalibrationContext,
  calibrationIssues,
  type CalibrationCandidate,
} from './scannerCalibrationForm'

export async function saveScannerCalibration(
  accountId: string,
  batchId: string,
  item: ScanImportItem,
  candidate: CalibrationCandidate,
  expectedRevision: number,
) {
  const calibrationContext = getCalibrationContext()
  scanReviewSnapshotSchema.parse({ candidate, lockState: item.lockState })
  if (calibrationIssues(item, candidate).length)
    throw new Error('仍有未通过检查的内容，请对照盘面补全或修正。')
  const changed = getScanCalibrationFields(item.candidate, candidate)
  const fields = changed.length
    ? changed
    : [
        ...new Set(
          item.issues.map((issue) =>
            issue.field === 'setId'
              ? 'setName'
              : issue.field.replace(/\.(stat|value|upgrades)$/, ''),
          ),
        ),
      ].filter((field) => isScanCalibrationField(field, candidate))
  if (!fields.length) throw new Error('没有可保存的校准内容。')
  // Save and recheck atomically: the final correction must never expose an unchecked import.
  return database.transaction(
    'rw',
    [
      database.settings,
      database.accountDriveDiscs,
      database.accountScanImportBatches,
      database.accountScanImportItems,
    ],
    async () => {
      await reviewAccountScanImportItem(
        accountId,
        batchId,
        item.id,
        { candidate, fields, lockState: item.lockState },
        calibrationContext,
        database,
        expectedRevision,
        'manual_calibration',
      )
      return preflightAccountScanReviewBatch(
        accountId,
        batchId,
        calibrationContext,
        database,
        expectedRevision + 1,
      )
    },
  )
}
