import imageTeamDirections from '../gameDataPacks/data/reviewed-team-image-directions.3.1.json'
import nestedTeamDirections from '../gameDataPacks/data/reviewed-team-nested-directions.3.1.json'
import { currentScopeManifest } from '../gameDataPacks/currentScopeManifest'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'

type OperationKind = 'order' | 'action' | 'condition'

type ReviewedOperationLine = {
  text: string
  version: string
  kind: OperationKind
  sourceKind: 'nested' | 'image'
  score: number
}

type ReviewedOperationRecord = {
  memberIds: readonly string[]
  conditions: readonly string[]
  sourceVersion: string
  sourceKind: 'nested' | 'image'
  conflicted: boolean
}

const releasedAgentIds = new Set(
  currentScopeManifest.entries
    .filter(
      (entry) =>
        entry.domain === 'agent' && entry.releaseState === 'released' && entry.accountOwnable,
    )
    .map((entry) => entry.stableId),
)

const currentVersion = currentVersionProjection.gameVersion
const teamKey = (memberIds: readonly string[]) => [...memberIds].sort().join('|')
const lineKey = (text: string) =>
  text
    .replace(/^较早版本（[^）]+）[｜|]\s*/u, '')
    .replace(/^(?:操作顺序|操作要点|触发条件)[：:]\s*/u, '')
    .replace(/[\s。；;，,、：:｜|]+/gu, '')
    .toLocaleLowerCase()

function validVersion(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d+\.\d+(?:\.\d+)?(?:[-+][a-z0-9.-]+)?$/iu.test(value)
}

function versionRank(value: string) {
  const match = value.match(/^(\d+)\.(\d+)(?:\.(\d+))?/u)
  if (!match) return 0
  return Number(match[1]) * 1_000 + Number(match[2]) * 10 + Number(match[3] ?? 0)
}

function isCurrentVersion(value: string) {
  return value === currentVersion || value.startsWith(`${currentVersion}-`)
}

function cleanCondition(text: string) {
  return text
    .trim()
    .replace(/^该?\d+(?:\.\d+)?版本攻略说明[：:]\s*/u, '')
    .replace(/^作者(?:建议|推荐|指出|认为|说明)?[：:]?\s*/u, '')
    .replaceAll('作者', '')
    .trim()
}

function isBoundaryOnly(text: string) {
  return (
    /^(?:HoyoBuild页面标记|本条只投影|不继承页面|不表示当期Boss|该三人方向不提供|该精确三人只确认|来源只支持当前可用方向|不由来源中的使用率|当前攻略直接列出|完整循环(?:和|与).*(?:未|不).*(?:证明|提供)|未证明完整循环|仅确认这组三人的搭配)/iu.test(
      text,
    ) || /\b(?:sourceVersion|schema|Tier|DPS)\b/iu.test(text)
  )
}

const actionPattern =
  /(?:开局|登场|入场|站场|离场|切换|切入|切回|切人|招架|闪反|快速支援|连携|强化特殊技|特殊技|普攻|蓄力|终结技|施放|释放|触发|积累|积蓄|积攒|消耗|回复|恢复|输出|染(?:冰|火|电|以太|物理|色))/u
const conditionPattern =
  /(?:需要|需|必须|至少|若|没有|缺少|不足|达到|保持|维持|覆盖|影画|潜能|能量|喧响|日珥|点数|生命|半血|属性异常|紊乱|额外能力|同阵营|队伍中|四件|2件)/u
const sequencePattern =
  /(?:先|再|然后|随后|之后|后切|后接|后由|后让|(?:强化特殊技|特殊技|普攻|连携|招架|闪反|支援|攻击|命中|入场|登场|蓄力)后|→)/gu

function classifyCondition(text: string): OperationKind | null {
  if (isBoundaryOnly(text)) return null
  const sequenceMarkers = [...text.matchAll(sequencePattern)].length
  const hasAction = actionPattern.test(text)
  const hasCondition = conditionPattern.test(text)
  if (sequenceMarkers >= 2 || text.includes('→') || /失衡前.*失衡(?:期|后)/u.test(text))
    return 'order'
  if (hasAction) return 'action'
  if (hasCondition) return 'condition'
  return null
}

function operationScore(
  text: string,
  version: string,
  kind: OperationKind,
  sourceKind: 'nested' | 'image',
) {
  const sequenceMarkers = [...text.matchAll(sequencePattern)].length
  const actionMarkers = text.match(
    /(?:切换|切入|切回|招架|连携|强化特殊技|特殊技|普攻|蓄力|终结技|施放|释放|触发|积累|积蓄|输出)/gu,
  )?.length
  const conditionMarkers = text.match(
    /(?:需要|必须|至少|没有|缺少|影画|潜能|能量|喧响|秒|点|层|件)/gu,
  )?.length
  return (
    versionRank(version) +
    (isCurrentVersion(version) ? 10_000 : 0) +
    (kind === 'order' ? 3_000 : kind === 'action' ? 2_000 : 1_000) +
    sequenceMarkers * 180 +
    (actionMarkers ?? 0) * 90 +
    (conditionMarkers ?? 0) * 70 +
    (sourceKind === 'nested' ? 20 : 0) +
    Math.min(text.length, 120)
  )
}

function hasIdentityConflict(record: object) {
  const value = record as {
    sourceConflictReview?: unknown
    imageLabelConflict?: unknown
  }
  return Boolean(value.sourceConflictReview || value.imageLabelConflict)
}

const records: ReviewedOperationRecord[] = [
  ...nestedTeamDirections.records.map<ReviewedOperationRecord>((record) => ({
    memberIds: record.memberIds,
    conditions: record.conditions,
    sourceVersion: record.source.sourceVersion,
    sourceKind: 'nested' as const,
    conflicted: hasIdentityConflict(record),
  })),
  ...imageTeamDirections.records.map<ReviewedOperationRecord>((record) => ({
    memberIds: record.memberIds,
    conditions: record.conditions,
    sourceVersion: record.sourceVersion ?? imageTeamDirections.sourceVersion,
    sourceKind: 'image' as const,
    conflicted: hasIdentityConflict(record),
  })),
].filter((record: ReviewedOperationRecord) => {
  const uniqueMembers = new Set(record.memberIds)
  return (
    record.memberIds.length === 3 &&
    uniqueMembers.size === 3 &&
    [...uniqueMembers].every((memberId) => releasedAgentIds.has(memberId)) &&
    validVersion(record.sourceVersion) &&
    !record.conflicted
  )
})

const linesByTeam = new Map<string, ReviewedOperationLine[]>()
for (const record of records) {
  const key = teamKey(record.memberIds)
  const target = linesByTeam.get(key) ?? []
  for (const raw of record.conditions) {
    const text = cleanCondition(raw)
    const kind = classifyCondition(text)
    if (!kind) continue
    target.push({
      text,
      version: record.sourceVersion,
      kind,
      sourceKind: record.sourceKind,
      score: operationScore(text, record.sourceVersion, kind, record.sourceKind),
    })
  }
  linesByTeam.set(key, target)
}

const projectedLinesByTeam = new Map<string, ReviewedOperationLine[]>()
for (const [key, candidates] of linesByTeam) {
  const unique = new Map<string, ReviewedOperationLine>()
  for (const candidate of candidates.sort((left, right) => right.score - left.score)) {
    const normalized = lineKey(candidate.text)
    if (!normalized || unique.has(normalized)) continue
    unique.set(normalized, candidate)
  }
  projectedLinesByTeam.set(key, [...unique.values()])
}

export const reviewedTeamOperationCoverage = Object.freeze({
  exactSourceTeamCount: linesByTeam.size,
  exactConditionTeamCount: [...projectedLinesByTeam.values()].filter((rows) => rows.length > 0)
    .length,
  operationTeamCount: [...projectedLinesByTeam.values()].filter((rows) =>
    rows.some((row) => row.kind === 'order' || row.kind === 'action'),
  ).length,
  orderTeamCount: [...projectedLinesByTeam.values()].filter((rows) =>
    rows.some((row) => row.kind === 'order'),
  ).length,
})

function historicalPrefix(version: string) {
  return isCurrentVersion(version) ? '' : `较早版本（${version}）｜`
}

/**
 * Projects only reviewed exact-team nested/image conditions. The result keeps
 * action order, action guidance, and trigger conditions as separate player
 * statements; it never fills missing steps from roles or generic play models.
 */
export function projectReviewedTeamOperationConditions(
  memberIds: readonly string[],
  excludedTexts: readonly string[] = [],
): readonly string[] {
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) return []
  const candidates = projectedLinesByTeam.get(teamKey(memberIds))
  if (!candidates?.length) return []
  const excluded = new Set(excludedTexts.map(lineKey))
  const available = candidates.filter((row) => !excluded.has(lineKey(row.text)))

  const orders = available.filter((row) => row.kind === 'order').slice(0, 2)
  const actions = orders.length ? [] : available.filter((row) => row.kind === 'action').slice(0, 1)
  const conditions = available.filter((row) => row.kind === 'condition').slice(0, 2)
  const grouped = new Map<`${OperationKind}:${string}`, ReviewedOperationLine[]>()
  for (const row of [...orders, ...actions, ...conditions]) {
    const key = `${row.kind}:${row.version}` as const
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  const labels: Record<OperationKind, string> = {
    order: '操作顺序',
    action: '操作要点',
    condition: '触发条件',
  }
  return [...grouped.values()].map((group) => {
    const first = group[0]!
    return `${historicalPrefix(first.version)}${labels[first.kind]}：${group
      .map((row) => row.text)
      .join('；')}`
  })
}
