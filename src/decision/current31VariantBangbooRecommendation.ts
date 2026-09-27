import type { TeamPredicate } from '../teamEngine/contracts'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import {
  effectiveBangbooActivationPredicate,
  evaluateTeamPredicate,
} from '../teamEngine/teamMethodR1'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import {
  current31ReviewedBangbooSourceAtoms,
  type ReviewedCurrent31BangbooSourceAtom,
} from '../gameDataPacks/generated/current31-reviewed-bangboo-source-atoms'
import { isReviewedSourceAtomContractValid } from '../gameDataPacks/reviewedBangbooSourceContract'
import reviewedGuideDefaults from '../gameDataPacks/data/reviewed-bangboo-guide-verification.3.1.json'
import { resolveReviewedImageBangbooDefaults } from '../gameDataPacks/reviewedImageBangbooDefaults'

export const current31VariantBangbooRecommendationContractId =
  'soda-current-3.1-variant-bangboo-recommendation/v2' as const

type Entry = readonly [readonly [string, string, string], string, string?]

export type Current31VariantBangbooSourceRef = {
  memberIds: readonly [string, string, string]
  bangbooId: string
  sourceRef: string
  sourceId?: string
  sourceUrl?: string
  locator?: string
}

const entries = [
  [['agent-yixuan', 'agent-dialyn', 'agent-lucia'], 'bangboo-belion'],
  [['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'], 'bangboo-belion'],
  [['agent-ye-shunguang', 'agent-dialyn', 'agent-sunna'], 'bangboo-sprout'],
  [['agent-ye-shunguang', 'agent-dialyn', 'agent-zhao'], 'bangboo-sprout'],
  [['agent-ye-shunguang', 'agent-sunna', 'agent-zhao'], 'bangboo-sprout'],
  [['agent-aria', 'agent-nangong', 'agent-sunna'], 'bangboo-biggest-fan'],
  [['agent-aria', 'agent-nangong', 'agent-yuzuha'], 'bangboo-biggest-fan'],
  [['agent-aria', 'agent-sunna', 'agent-yuzuha'], 'bangboo-biggest-fan'],
  [['agent-aria', 'agent-remielle', 'agent-velina'], 'bangboo-ariel'],
  [['agent-remielle', 'agent-promeia', 'agent-velina'], 'bangboo-ariel'],
  [['agent-remielle', 'agent-burnice', 'agent-velina'], 'bangboo-ariel'],
  [['agent-sigrid', 'agent-norma', 'agent-sunna'], 'bangboo-ultra-jake'],
  [['agent-sigrid', 'agent-norma', 'agent-astra'], 'bangboo-ultra-jake'],
  [['agent-miyabi', 'agent-nangong', 'agent-yuzuha'], 'bangboo-biggest-fan'],
  [['agent-yixuan', 'agent-lucia', 'agent-astra'], 'bangboo-belion'],
  [['agent-yixuan', 'agent-pulchra', 'agent-lucia'], 'bangboo-belion'],
  [['agent-ye-shunguang', 'agent-astra', 'agent-zhao'], 'bangboo-sprout'],
  [['agent-ye-shunguang', 'agent-trigger', 'agent-zhao'], 'bangboo-sprout'],
  [['agent-ye-shunguang', 'agent-seed', 'agent-zhao'], 'bangboo-sprout'],
  [['agent-promeia', 'agent-velina', 'agent-yuzuha'], 'bangboo-ultra-jake'],
  [['agent-jane', 'agent-vivian', 'agent-yuzuha'], 'bangboo-robin'],
  [['agent-alice', 'agent-vivian', 'agent-yuzuha'], 'bangboo-miss-esme'],
  [['agent-promeia', 'agent-vivian', 'agent-yuzuha'], 'bangboo-robin'],
  [['agent-remielle', 'agent-jane', 'agent-velina'], 'bangboo-ariel'],
  [['agent-remielle', 'agent-alice', 'agent-velina'], 'bangboo-ariel'],
  [['agent-remielle', 'agent-piper', 'agent-velina'], 'bangboo-ariel'],
  [['agent-remielle', 'agent-vivian', 'agent-velina'], 'bangboo-ariel'],
  [['agent-miyabi', 'agent-vivian', 'agent-yuzuha'], 'bangboo-robin'],
  [['agent-miyabi', 'agent-yanagi', 'agent-astra'], 'bangboo-agent-gulliver'],
  [['agent-miyabi', 'agent-lycaon', 'agent-soukaku'], 'bangboo-butler'],
  [
    ['agent-promeia', 'agent-nangong', 'agent-yuzuha'],
    'bangboo-knightboo',
    'teamArchetypeSourceLedger.v1.json#team-3.1-promeia-nangong-yuzuha-knightboo',
  ],
  [
    ['agent-pyrois', 'agent-norma', 'agent-sunna'],
    'bangboo-ultra-jake',
    'teamArchetypeSourceLedger.v1.json#team-3.1-pyrois-norma-sunna-ultra-jake',
  ],
] as const satisfies readonly Entry[]

// Exact trio membership plus an explicit author recommendation or a reviewed
// image of that exact four-member lineup is required. Generic activation
// options are never promoted into this mapping.
const reviewedGuideEntries: readonly Entry[] = reviewedGuideDefaults.records.map((record) => [
  record.memberIds as [string, string, string],
  record.bangbooId,
  `${record.url}#${record.locator}`,
])
const allEntries: readonly Entry[] = [...entries, ...reviewedGuideEntries]

function formationKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

const namedRecommendationByFormationKey = new Map(
  allEntries.map(([memberIds, bangbooId]) => [formationKey(memberIds), bangbooId]),
)

const releasedAgentIds = new Set(
  currentAssetProjection.agents
    .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
    .map((entry) => entry.stableId),
)
const currentBangbooIds = new Set(
  currentAssetProjection.bangboos
    .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
    .map((entry) => entry.stableId),
)

function sourceAtomEntry(atom: ReviewedCurrent31BangbooSourceAtom) {
  if (
    atom.gameVersion !== '3.1' ||
    atom.status !== 'candidate' ||
    !atom.evidenceScope.includes('membership, role and bangboo relationship') ||
    atom.lineup.length !== 4 ||
    new Set(atom.lineup).size !== 4
  )
    return null
  const memberIds = atom.lineup.filter((stableId) => stableId.startsWith('agent-'))
  const bangbooIds = atom.lineup.filter((stableId) => stableId.startsWith('bangboo-'))
  if (
    memberIds.length !== 3 ||
    bangbooIds.length !== 1 ||
    !memberIds.every((stableId) => releasedAgentIds.has(stableId)) ||
    !currentBangbooIds.has(bangbooIds[0]!)
  )
    return null
  return {
    memberIds: memberIds as [string, string, string],
    bangbooId: bangbooIds[0]!,
    sourceRef: `${atom.sourceId}#${atom.locator}`,
    sourceId: atom.sourceId,
    sourceUrl: atom.sourceUrl,
    locator: atom.locator,
  } satisfies Current31VariantBangbooSourceRef
}

export function resolveReviewedSourceAtomFallbacks(
  atoms: readonly ReviewedCurrent31BangbooSourceAtom[],
  namedAuthorities: ReadonlySet<string> = new Set(),
) {
  if (!isReviewedSourceAtomContractValid() && atoms === current31ReviewedBangbooSourceAtoms.atoms)
    return new Map<string, Current31VariantBangbooSourceRef>()
  const candidatesByFormationKey = new Map<string, Current31VariantBangbooSourceRef[]>()
  for (const atom of atoms) {
    const candidate = sourceAtomEntry(atom)
    if (!candidate) continue
    const key = formationKey(candidate.memberIds)
    if (namedAuthorities.has(key)) continue
    const candidates = candidatesByFormationKey.get(key) ?? []
    candidates.push(candidate)
    candidatesByFormationKey.set(key, candidates)
  }
  const resolved = new Map<string, Current31VariantBangbooSourceRef>()
  for (const [key, candidates] of candidatesByFormationKey) {
    const bangbooIds = new Set(candidates.map((candidate) => candidate.bangbooId))
    if (bangbooIds.size !== 1) continue
    const [candidate] = candidates
    if (candidate) resolved.set(key, candidate)
  }
  return resolved
}

const sourceAtomFallbackByFormationKey = resolveReviewedSourceAtomFallbacks(
  current31ReviewedBangbooSourceAtoms.atoms,
  new Set(namedRecommendationByFormationKey.keys()),
)

const namedSourceRefs: readonly Current31VariantBangbooSourceRef[] = allEntries.flatMap(
  ([memberIds, bangbooId, sourceRef]) => (sourceRef ? [{ memberIds, bangbooId, sourceRef }] : []),
)
const sourceAtomRefs = [...sourceAtomFallbackByFormationKey.values()]
const reviewedImageRefs = resolveReviewedImageBangbooDefaults().filter((source) => {
  const key = formationKey(source.memberIds)
  return (
    !namedRecommendationByFormationKey.has(key) &&
    !sourceAtomFallbackByFormationKey.has(key) &&
    source.memberIds.every((id) => releasedAgentIds.has(id)) &&
    currentBangbooIds.has(source.bangbooId)
  )
})
const imageFallbackByFormationKey = new Map(
  reviewedImageRefs.map((source) => [formationKey(source.memberIds), source]),
)
const sourceRefs = [...namedSourceRefs, ...sourceAtomRefs, ...reviewedImageRefs]

function isStaticActivationPredicate(predicate: TeamPredicate): boolean {
  if (predicate.kind === 'all' || predicate.kind === 'any')
    return predicate.predicates.every(isStaticActivationPredicate)
  return [
    'agent_present',
    'specialty_count',
    'faction_count',
    'attribute_count',
    'distinct_attribute_count',
  ].includes(predicate.kind)
}

function hasKnownActivationConflict(memberIds: readonly string[], bangbooId: string) {
  const rule = current31TeamEngineD1Pack.bangbooRules.find((item) => item.bangbooId === bangbooId)
  // Missing modeling is not a proof that an author's option is impossible.
  if (!rule || rule.activation.status !== 'modeled') return false
  const activation = rule.activation
  // The source resolver has no account state. Defer dynamic or unmodeled
  // activation to the target query rather than treating missing state as false.
  if (!isStaticActivationPredicate(activation.predicate)) return false
  const agents = memberIds.map((id) =>
    current31TeamEngineD1Pack.agentRules.find((item) => item.agentId === id),
  )
  if (!agents.every((agent): agent is NonNullable<typeof agent> => Boolean(agent))) return false
  const context = {
    agents,
    producedTags: new Set(agents.flatMap((agent) => agent.produces)),
    agentStateById: {},
  }
  // Preserve reviewed minimum-star defaults such as S3 Belion. A source direction
  // conflicts only when no supported star can activate its exact three members.
  return !([1, 2, 3, 4, 5] as const).some((star) =>
    evaluateTeamPredicate(
      effectiveBangbooActivationPredicate(bangbooId, activation, star),
      context,
    ),
  )
}

export function resolveCurrent31VariantBangbooRecommendation(
  memberIds: readonly [string, string, string],
) {
  const key = formationKey(memberIds)
  const sourceDefault =
    namedRecommendationByFormationKey.get(key) ??
    sourceAtomFallbackByFormationKey.get(key)?.bangbooId ??
    imageFallbackByFormationKey.get(key)?.bangbooId ??
    null
  return sourceDefault && hasKnownActivationConflict(memberIds, sourceDefault)
    ? null
    : sourceDefault
}

const sourceDefaults = new Map([
  ...namedRecommendationByFormationKey,
  ...[...sourceAtomFallbackByFormationKey].map(([key, source]) => [key, source.bangbooId] as const),
  ...[...imageFallbackByFormationKey].map(([key, source]) => [key, source.bangbooId] as const),
])
const activationBlockedSourceDefaults = [...sourceDefaults].flatMap(([key, bangbooId]) => {
  const memberIds = key.split('|') as [string, string, string]
  return hasKnownActivationConflict(memberIds, bangbooId) ? [{ memberIds, bangbooId }] : []
})

export const current31VariantBangbooRecommendationSet = Object.freeze({
  contract: current31VariantBangbooRecommendationContractId,
  gameVersion: '3.1',
  entries: allEntries,
  reviewedGuideDefaults,
  sourceRefs,
  reviewedSourceAtoms: current31ReviewedBangbooSourceAtoms,
  reviewedSourceAtomFallbackCount: sourceAtomFallbackByFormationKey.size,
  reviewedImageFallbackCount: imageFallbackByFormationKey.size,
  // Source observations stay complete even when their activation conflicts with the exact trio.
  exactVariantCount: sourceDefaults.size,
  usableDefaultVariantCount: sourceDefaults.size - activationBlockedSourceDefaults.length,
  activationBlockedSourceDefaults,
  inventoryAuthority: false,
  boundary:
    '该映射只给出精确三人 Variant 的来源化候选邦布参数：既有具名权威优先，审阅 source atom 和当前版本无歧义的攻略图片选项仅补缺。它不读取账户库存、不创建队伍、不改变 Family 身份，也不携带 Team Strength Band。未命中、source 冲突或已建模的激活条件在所有星级均不成立时必须保持 null，禁止按 Family 猜测。',
})
