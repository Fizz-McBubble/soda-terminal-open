import type { DriveDiscImportSetIdentity } from './discImport'
import type { DriveDiscDataManifest, DriveDiscSet, StatKey } from './schemas'
import type { ScanImportItem, ScanImportIssue } from './scanImportStagingSchemas'
import { scanMainStatDisplayValue } from './scanMainStatDisplay'
export type ScanImportAssessmentContext = {
  driveDiscSets: DriveDiscSet[]
  driveDiscSetIdentities?: DriveDiscImportSetIdentity[]
  rules: DriveDiscDataManifest['rules']
  dataVersion: string
}

function issue(
  field: string,
  code: string,
  message: string,
  severity: ScanImportIssue['severity'] = 'review',
): ScanImportIssue {
  return { field, code, message, severity }
}

function getSubStatExpectedValue(
  stat: StatKey,
  rarity: 'A' | 'S',
  upgrades: number,
  rules: DriveDiscDataManifest['rules'],
) {
  const rule = rules.subStatStepsByRarity[rarity].find((candidate) => candidate.stat === stat)
  return rule ? rule.baseValue * (upgrades + 1) : null
}

function isEmptySubStat(subStat: ScanImportItem['candidate']['subStats'][number]) {
  return subStat.stat === null && subStat.value === null && subStat.upgrades === null
}

export function normalizeCandidate(candidate: ScanImportItem['candidate']) {
  if (candidate.level === null || candidate.level >= 3) return candidate
  return {
    ...candidate,
    subStats: candidate.subStats.filter((subStat) => !isEmptySubStat(subStat)),
  }
}

export function assessScanImportItem(
  input: ScanImportItem,
  context: ScanImportAssessmentContext,
): ScanImportItem {
  if (input.state === 'imported') return input
  const candidate = normalizeCandidate(input.candidate)
  const issues: ScanImportIssue[] = []
  const set = [...context.driveDiscSets, ...(context.driveDiscSetIdentities ?? [])].find(
    (item) => item.id === candidate.setId,
  )

  if (!set || !candidate.setName)
    issues.push(issue('setId', 'missing_set', '请选择可核验的驱动盘套装。'))
  else if (set.evidenceOnly)
    issues.push(issue('setId', 'evidence_only_set', '该套装只有截图证据，需人工确认正式映射。'))
  if (candidate.slot === null) issues.push(issue('slot', 'missing_slot', '缺少号位。'))
  if (candidate.level === null) issues.push(issue('level', 'missing_level', '缺少强化等级。'))
  if (!candidate.rarity) issues.push(issue('rarity', 'missing_rarity', '缺少稀有度。'))
  if (!candidate.mainStat) issues.push(issue('mainStat', 'missing_main_stat', '缺少主词条。'))
  if (candidate.mainStatValue === null)
    issues.push(issue('mainStatValue', 'missing_main_stat_value', '缺少主词条数值证据。'))
  if (input.duplicate)
    issues.push(issue('fingerprint', 'duplicate', '检测到重复指纹，需人工确认实体。'))

  if (candidate.slot !== null && candidate.mainStat) {
    const allowed = context.rules.mainStatsBySlot[String(candidate.slot)] ?? []
    if (!allowed.includes(candidate.mainStat))
      issues.push(
        issue('mainStat', 'illegal_main_stat', `${candidate.slot} 号位不允许该主词条。`, 'invalid'),
      )
    if (candidate.rarity && candidate.level !== null && candidate.mainStatValue !== null) {
      const valueRule = context.rules.mainStatBaseByRarity[candidate.rarity].find(
        (item) => item.stat === candidate.mainStat,
      )
      const maxLevel = context.rules.maxLevelByRarity[candidate.rarity]
      const normalizedExpected = valueRule
        ? scanMainStatDisplayValue(
            valueRule.baseValue,
            candidate.level,
            maxLevel,
            valueRule.unit,
            input.fields.mainStat,
          )
        : null
      if (
        normalizedExpected === null ||
        Math.abs(normalizedExpected - candidate.mainStatValue) > 0.051
      )
        issues.push(
          issue(
            'mainStatValue',
            'main_stat_value_mismatch',
            '主词条数值与稀有度、等级不匹配。',
            'invalid',
          ),
        )
    }
  }
  if (candidate.rarity && candidate.level !== null) {
    const maxLevel = context.rules.maxLevelByRarity[candidate.rarity]
    if (candidate.level > maxLevel)
      issues.push(issue('level', 'level_out_of_range', '强化等级超过稀有度上限。', 'invalid'))
  }

  const expectedSubStatCount = candidate.level !== null && candidate.level >= 3 ? 4 : 3
  if (candidate.subStats.length < expectedSubStatCount || candidate.subStats.length > 4)
    issues.push(
      issue(
        'subStats',
        'sub_stat_count',
        `当前等级应有 ${expectedSubStatCount}-4 条副词条，实际识别 ${candidate.subStats.length} 条。`,
      ),
    )
  const seen = new Set<StatKey>()
  for (const [index, subStat] of candidate.subStats.entries()) {
    if (!subStat.stat || subStat.value === null || subStat.upgrades === null) {
      issues.push(
        issue(`subStats.${index}`, 'missing_sub_stat', `副词条 ${index + 1} 信息不完整。`),
      )
      continue
    }
    if (seen.has(subStat.stat))
      issues.push(
        issue(`subStats.${index}.stat`, 'duplicate_sub_stat', '副词条字段重复。', 'invalid'),
      )
    seen.add(subStat.stat)
    if (candidate.rarity) {
      const expected = getSubStatExpectedValue(
        subStat.stat,
        candidate.rarity,
        subStat.upgrades,
        context.rules,
      )
      if (expected === null || Math.abs(expected - subStat.value) > 0.051)
        issues.push(
          issue(
            `subStats.${index}.value`,
            'sub_stat_value_mismatch',
            `副词条 ${index + 1} 数值与强化次数不匹配。`,
            'invalid',
          ),
        )
    }
  }

  const uniqueIssues = [
    ...new Map(issues.map((item) => [`${item.field}:${item.code}`, item])).values(),
  ]
  return {
    ...input,
    candidate,
    state: uniqueIssues.some((item) => item.severity === 'invalid')
      ? 'invalid'
      : uniqueIssues.length
        ? 'needs_review'
        : 'ready',
    issues: uniqueIssues,
  }
}
