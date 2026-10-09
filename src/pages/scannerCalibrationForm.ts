import {
  publicScannerDriveDiscData,
  publicScannerSetIdentities,
} from '../application/publicScannerCatalog'
import { assessScanImportItem, type ScanImportItem } from '../domain/scanImportStaging'

export type CalibrationCandidate = ScanImportItem['candidate']
export function getCalibrationContext() {
  if (!publicScannerDriveDiscData) throw new Error('驱动盘规则暂不可用，请刷新页面后重试。')
  return {
    driveDiscSets: publicScannerDriveDiscData.driveDiscSets,
    driveDiscSetIdentities: publicScannerSetIdentities,
    rules: publicScannerDriveDiscData.rules,
    dataVersion: publicScannerDriveDiscData.dataVersion,
  }
}

export function calibrateSubStatValues(candidate: CalibrationCandidate): CalibrationCandidate {
  const calibrationContext = getCalibrationContext()
  return {
    ...candidate,
    subStats: candidate.subStats.map((row) => {
      const rule = candidate.rarity
        ? calibrationContext.rules.subStatStepsByRarity[candidate.rarity].find(
            (entry) => entry.stat === row.stat,
          )
        : undefined
      const upgrades =
        rule && row.value !== null
          ? ([0, 1, 2, 3, 4, 5].find(
              (count) => Math.abs(rule.baseValue * (count + 1) - row.value!) <= 0.051,
            ) ?? null)
          : null
      return { ...row, upgrades }
    }),
  }
}

export function calibrationIssues(item: ScanImportItem, candidate: CalibrationCandidate) {
  return assessScanImportItem({ ...item, candidate }, getCalibrationContext()).issues
}

export function calibrationFieldMessages(item: ScanImportItem, candidate: CalibrationCandidate) {
  return calibrationIssues(item, candidate).map((issue) => ({
    ...issue,
    message:
      issue.code === 'duplicate'
        ? '这张盘的扫描身份重复，需要重新扫描，暂不能通过手动校准处理。'
        : issue.code === 'missing_sub_stat'
          ? `${issue.message.replace('信息不完整。', '')}请补全名称和盘面数值；数值须符合该稀有度。`
          : issue.message,
  }))
}
