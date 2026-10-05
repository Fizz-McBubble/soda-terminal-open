import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { currentVersionAdoption32 } from '../gameDataPacks/currentVersionAdoption32'
import imageDirections from '../gameDataPacks/data/reviewed-team-image-directions.3.1.json'
import nestedDirections from '../gameDataPacks/data/reviewed-team-nested-directions.3.1.json'
import reusedDirections from '../gameDataPacks/data/reviewed-team-direction-reuse.3.1.json'

export type DeploymentRuleStrength = 'required' | 'preferred'

export type ReviewedTeamDeploymentRule =
  | {
      kind: 'cyclic_order'
      orderedMemberIds: readonly [string, string, string]
      strength: DeploymentRuleStrength
      basis: 'current' | 'retained'
    }
  | {
      kind: 'slot'
      agentId: string
      slot: 1 | 2 | 3
      strength: DeploymentRuleStrength
      basis: 'current' | 'retained'
    }
  | {
      kind: 'starter'
      agentId: string
      strength: DeploymentRuleStrength
      basis: 'current' | 'retained'
    }

export type ReviewedTeamDeploymentSource = {
  sourceId: string
  gameVersion: string
  url: string
  locator: string
  excerpt: string
  applicability: 'current' | 'historical_reuse'
}

export type ReviewedTeamDeploymentEvidence = {
  memberIds: readonly [string, string, string]
  rules: readonly ReviewedTeamDeploymentRule[]
  sources: readonly ReviewedTeamDeploymentSource[]
}

type RawDirectionRecord = {
  claimId: string
  memberIds: readonly string[]
  conditions?: readonly string[]
  source?: { url?: string; sourceVersion?: string }
  sourceUrl?: string
  sourceVersion?: string
  applicabilityDisposition?: string
  sourceLocalSlotId?: string
  nested?: { locator?: unknown }
  imageSourceLocator?: unknown
  imageSha256?: string
  imageRegion?: string
  charStart?: number
  charEnd?: number
}

type LocatedRecord = RawDirectionRecord & { origin: 'nested' | 'image' | 'reuse' }

// Every accepted grammar below names a relative position, numbered slot, or starter.
// Most source conditions discuss builds and rotations without any placement language;
// reject those before expanding agent aliases into regular expressions.
const deploymentLanguageMarker =
  /(?:之前|之后|前一位|后一位|位于|置于|放在|首发|[123]号(?:位)?|在[^，；。]{1,16}前)/

const extraAliases: Readonly<Record<string, readonly string[]>> = {
  'agent-remielle': ['蕾米埃尔', '蕾米'],
  'agent-starlight-billy': ['星徽比利'],
  'agent-billy': ['比利'],
  'agent-soldier-11': ['11号'],
  'agent-manato': ['真斗'],
  'agent-trigger': ['扳机'],
  'agent-astra': ['嘉音'],
  'agent-yixuan': ['仪玄'],
  'agent-yanagi': ['月城柳'],
  'agent-miyabi': ['雅'],
  'agent-seed': ['席德'],
  'agent-orphie-magus': ['奥菲丝'],
}

function cleanName(value: string) {
  return value.replace(/[\s·・「」“”"'&]/g, '')
}

const aliasesByAgentId = new Map(
  currentAssetProjection.agents.map((agent) => {
    const names = [
      agent.playerName,
      cleanName(agent.playerName),
      ...(extraAliases[agent.stableId] ?? []),
    ]
      .filter(Boolean)
      .sort((left, right) => right.length - left.length)
    return [agent.stableId, [...new Set(names)]] as const
  }),
)

function memberKey(memberIds: readonly string[]) {
  return memberIds.map(resolveCurrentReleasedIdentity).sort().join('|')
}

function regexText(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function aliases(agentId: string) {
  return aliasesByAgentId.get(agentId) ?? [agentId]
}

function aliasPattern(agentId: string) {
  return `(?:${aliases(agentId).map(regexText).join('|')})`
}

const relationPatterns = new Map<string, RegExp>()
const fullOrderPatterns = new Map<string, RegExp>()
const strengthPatterns = new Map<string, RegExp>()
const slotPatterns = new Map<string, RegExp>()
const starterPatterns = new Map<string, RegExp>()

function cachedPattern(cache: Map<string, RegExp>, key: string, source: () => string) {
  const existing = cache.get(key)
  if (existing) return existing
  const pattern = new RegExp(source())
  cache.set(key, pattern)
  return pattern
}

function relationAppears(
  text: string,
  leftId: string,
  rightId: string,
  direction: 'before' | 'after',
) {
  const ending = direction === 'before' ? '(?:之前|前一位|前)' : '(?:之后|后一位)'
  const key = `${leftId}|${rightId}|${direction}`
  return cachedPattern(relationPatterns, key, () => {
    const prefix = '(?:通常将)?'
    const verb = '(?:可|应|需|建议)?(?:位于|置于|放在|应放在|需要放在|应置于|在)'
    return `${prefix}${aliasPattern(leftId)}${verb}${aliasPattern(rightId)}${ending}`
  }).test(text)
}

function fullOrderAppears(text: string, middleId: string, beforeId: string, afterId: string) {
  const key = `${middleId}|${beforeId}|${afterId}`
  return cachedPattern(
    fullOrderPatterns,
    key,
    () =>
      `(?:通常将)?${aliasPattern(middleId)}(?:可|应|需)?(?:位于|置于)${aliasPattern(beforeId)}(?:之后|后一位)[、，]?${aliasPattern(afterId)}(?:之前|前一位)`,
  ).test(text)
}

function strengthFor(
  record: LocatedRecord,
  excerpt: string,
  memberIds: readonly string[],
): DeploymentRuleStrength {
  if (basisFor(record) === 'retained') return 'preferred'
  return memberIds.some((agentId) =>
    cachedPattern(
      strengthPatterns,
      agentId,
      () =>
        `(?:通常将${aliasPattern(agentId)}|${aliasPattern(agentId)}可(?:位于|置于|放在|首发)|建议(?:将)?${aliasPattern(agentId)})`,
    ).test(excerpt),
  )
    ? 'preferred'
    : 'required'
}

/** Review applicability follows the adopted field authority, separately from
 * the player-facing catalogue version. The bridge is only adopted for 3.2. */
export function reviewedTeamDeploymentVersion(currentVersion: string) {
  return currentVersion === currentVersionAdoption32.gameVersion
    ? currentVersionAdoption32.legacyFieldAuthority.gameVersion
    : currentVersion
}

function basisFor(record: RawDirectionRecord): 'current' | 'retained' {
  // A source-local "current" label has no authority over another read version.
  const versionCurrent =
    sourceVersion(record) === reviewedTeamDeploymentVersion(currentVersionProjection.gameVersion)
  return versionCurrent ? 'current' : 'retained'
}

function sourceVersion(record: RawDirectionRecord) {
  return record.source?.sourceVersion ?? record.sourceVersion ?? 'unspecified'
}

function sourceFor(record: LocatedRecord, excerpt: string): ReviewedTeamDeploymentSource {
  const current = basisFor(record) === 'current'
  const locator =
    record.origin === 'nested'
      ? record.nested?.locator
      : record.origin === 'image'
        ? (record.imageSourceLocator ?? {
            imageSha256: record.imageSha256,
            region: record.imageRegion,
          })
        : {
            start: record.charStart,
            end: record.charEnd,
            sourceLocalSlotId: record.sourceLocalSlotId,
          }
  return {
    sourceId: record.claimId,
    gameVersion: sourceVersion(record),
    url: record.source?.url ?? record.sourceUrl ?? '',
    locator: JSON.stringify(locator ?? { sourceLocalSlotId: record.sourceLocalSlotId }),
    excerpt,
    applicability: current ? 'current' : 'historical_reuse',
  }
}

function inferRules(record: LocatedRecord, excerpt: string): ReviewedTeamDeploymentRule[] {
  if (!deploymentLanguageMarker.test(excerpt)) return []
  const memberIds = record.memberIds.map(resolveCurrentReleasedIdentity) as [string, string, string]
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) return []
  const strength = strengthFor(record, excerpt, memberIds)
  const basis = basisFor(record)
  const rules: ReviewedTeamDeploymentRule[] = []

  for (const middle of memberIds)
    for (const before of memberIds)
      for (const after of memberIds)
        if (
          new Set([middle, before, after]).size === 3 &&
          fullOrderAppears(excerpt, middle, before, after)
        )
          rules.push({
            kind: 'cyclic_order',
            orderedMemberIds: [before, middle, after],
            strength,
            basis,
          })

  // The source says "support" rather than repeating the exact third member name.
  if (
    memberIds.includes('agent-aria') &&
    memberIds.includes('agent-nangong') &&
    /南宫羽可位于爱芮之后、支援之前/.test(excerpt)
  ) {
    const support = memberIds.find((id) => id !== 'agent-aria' && id !== 'agent-nangong')!
    rules.push({
      kind: 'cyclic_order',
      orderedMemberIds: ['agent-aria', 'agent-nangong', support],
      strength: 'preferred',
      basis,
    })
  }

  if (!rules.some((rule) => rule.kind === 'cyclic_order')) {
    for (const left of memberIds)
      for (const right of memberIds) {
        if (left === right) continue
        const before = relationAppears(excerpt, left, right, 'before')
        const after = relationAppears(excerpt, left, right, 'after')
        if (!before && !after) continue
        const first = before ? left : right
        const second = before ? right : left
        const third = memberIds.find((id) => id !== first && id !== second)!
        rules.push({
          kind: 'cyclic_order',
          orderedMemberIds: [first, second, third],
          strength,
          basis,
        })
      }
  }

  for (const agentId of memberIds) {
    const match = excerpt.match(
      cachedPattern(
        slotPatterns,
        agentId,
        () => `${aliasPattern(agentId)}(?:需在|应在)?([123])号(?:位)?`,
      ),
    )
    if (match)
      rules.push({
        kind: 'slot',
        agentId,
        slot: Number(match[1]) as 1 | 2 | 3,
        strength,
        basis,
      })
    if (
      cachedPattern(
        starterPatterns,
        agentId,
        () => `(?:${aliasPattern(agentId)}(?:应|可)?首发|首发${aliasPattern(agentId)})`,
      ).test(excerpt)
    )
      rules.push({ kind: 'starter', agentId, strength, basis })
  }
  return dedupeRules(rules)
}

function ruleKey(rule: ReviewedTeamDeploymentRule) {
  if (rule.kind === 'cyclic_order') {
    const [first, second, third] = rule.orderedMemberIds
    const cycle = [
      `${first}>${second}>${third}`,
      `${second}>${third}>${first}`,
      `${third}>${first}>${second}`,
    ].sort()[0]
    return `cyclic:${cycle}:${rule.strength}:${rule.basis}`
  }
  return `${rule.kind}:${rule.agentId}:${rule.kind === 'slot' ? rule.slot : ''}:${rule.strength}:${rule.basis}`
}

function dedupeRules(rules: readonly ReviewedTeamDeploymentRule[]) {
  return [...new Map(rules.map((rule) => [ruleKey(rule), rule])).values()]
}

function allRecords(): LocatedRecord[] {
  return [
    ...(nestedDirections.records as unknown as RawDirectionRecord[]).map((record) => ({
      ...record,
      origin: 'nested' as const,
    })),
    ...(imageDirections.records as unknown as RawDirectionRecord[]).map((record) => ({
      ...record,
      origin: 'image' as const,
    })),
    ...(reusedDirections.records as unknown as RawDirectionRecord[]).map((record) => ({
      ...record,
      origin: 'reuse' as const,
    })),
  ]
}

export function currentReviewedTeamDeploymentEvidence(): ReviewedTeamDeploymentEvidence[] {
  const byMembers = new Map<
    string,
    {
      memberIds: [string, string, string]
      rules: ReviewedTeamDeploymentRule[]
      sources: ReviewedTeamDeploymentSource[]
    }
  >()
  for (const record of allRecords()) {
    const memberIds = record.memberIds.map(resolveCurrentReleasedIdentity) as [
      string,
      string,
      string,
    ]
    if (memberIds.length !== 3 || new Set(memberIds).size !== 3) continue
    for (const excerpt of record.conditions ?? []) {
      const rules = inferRules(record, excerpt)
      if (!rules.length) continue
      const key = memberKey(memberIds)
      const entry = byMembers.get(key) ?? { memberIds, rules: [], sources: [] }
      entry.rules.push(...rules)
      entry.sources.push(sourceFor(record, excerpt))
      byMembers.set(key, entry)
    }
  }
  return [...byMembers.values()]
    .map((entry) => ({
      memberIds: [...entry.memberIds] as [string, string, string],
      rules: dedupeRules(entry.rules),
      sources: [
        ...new Map(
          entry.sources.map((source) => [
            `${source.sourceId}|${source.excerpt}|${source.locator}`,
            source,
          ]),
        ).values(),
      ],
    }))
    .sort((left, right) => memberKey(left.memberIds).localeCompare(memberKey(right.memberIds)))
}

export function createReviewedTeamDeploymentEvidenceIndex(
  evidence: readonly ReviewedTeamDeploymentEvidence[] = currentReviewedTeamDeploymentEvidence(),
) {
  const snapshot = evidence.map((entry) => ({
    memberIds: [...entry.memberIds] as [string, string, string],
    rules: entry.rules.map((rule) =>
      rule.kind === 'cyclic_order'
        ? { ...rule, orderedMemberIds: [...rule.orderedMemberIds] as [string, string, string] }
        : { ...rule },
    ),
    sources: entry.sources.map((source) => ({ ...source })),
  }))
  const byMembers = new Map(snapshot.map((entry) => [memberKey(entry.memberIds), entry]))
  return {
    lookup(memberIds: readonly string[]) {
      if (
        memberIds.length !== 3 ||
        new Set(memberIds.map(resolveCurrentReleasedIdentity)).size !== 3
      )
        return null
      return byMembers.get(memberKey(memberIds)) ?? null
    },
    coverage: {
      sourceRecordExactTeamCount: new Set(allRecords().map((record) => memberKey(record.memberIds)))
        .size,
      deploymentEvidenceTeamCount: snapshot.length,
      currentRuleTeamCount: snapshot.filter((entry) =>
        entry.sources.some((source) => source.applicability === 'current'),
      ).length,
      historicalReuseTeamCount: snapshot.filter((entry) =>
        entry.sources.some((source) => source.applicability === 'historical_reuse'),
      ).length,
    },
  }
}
