import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { PlanningConditionProjection32 } from './currentPlanningConditionCatalog32'

import { reviewedRoxyAttributeWindowsIdentity32 } from './reviewedRoxyAttributeWindowsIdentity32'
export {
  reviewedRoxyAttributeWindowsIdentity32,
  identity32,
} from './reviewedRoxyAttributeWindowsIdentity32'
const identity = reviewedRoxyAttributeWindowsIdentity32
const coreKeys = ['agent-roxy:core_crit_dmg_', 'agent-roxy:core_laceration_dmg_']
const abilityKey = 'agent-roxy:ability_direct_dmg_'
const predicates = [
  ['roxyCoreWindowWind32', '洛克希风属性50秒历史增益窗仍生效'],
  ['roxyCoreWindowElectric32', '洛克希电属性50秒历史增益窗仍生效'],
  ['roxySquadWindswept32', '敌人当前风蚀由本队成员施加'],
  ['roxyContaminationMatchesEvent32', '当前污染属性与本次具名事件属性一致'],
] as const
const sourceRefs = [
  `https://github.com/frzyc/genshin-optimizer@${identity.commit}`,
  `${identity.formulaPath}#sha256=${identity.formulaSha256}`,
  `${identity.localizationPath}#sha256=${identity.localizationSha256}`,
  `semantic-overlay:${identity.revision}`,
]
function sourceMatches(entry: CurrentAgentPlanningEffectBlueprint) {
  const contract = getCurrentAgentEventContract('agent-roxy')
  const hashes: Readonly<Record<string, string>> = identity.expressions
  return Boolean(
    contract &&
    contract.source.commit === identity.commit &&
    contract.source.formulaPath === identity.formulaPath &&
    contract.source.formulaSha256 === identity.formulaSha256 &&
    entry.providerAgentId === 'agent-roxy' &&
    entry.numericExpression.expressionSha256 === hashes[entry.effectKey] &&
    entry.sourceRefs.includes(`${identity.formulaPath}#${identity.formulaSha256}`),
  )
}

/** Add only the four observed predicates. No trigger, expiry time, or full rotation is inferred. */
export function applyReviewedRoxyAttributeWindowDomains32(
  projection: PlanningConditionProjection32,
): void {
  const contamination = projection.evidence.find(
    (row) => row.providerAgentId === 'agent-roxy' && row.referenceKey === 'contamination',
  )
  if (!contamination) return
  const entries = [...coreKeys, abilityKey].map(getCurrentAgentPlanningEffectBlueprint)
  if (entries.some((entry) => !entry || !sourceMatches(entry))) {
    projection.status = 'unsupported'
    projection.blockers.push('洛克希属性窗口的锁定来源或表达式已改变。')
    return
  }
  const scopes = projection.evidence
    .filter((row) => row.providerAgentId === 'agent-roxy')
    .flatMap((row) => row.eventScopes)
  for (const [referenceKey, label] of predicates) {
    const effectKeys = referenceKey.startsWith('roxyCoreWindow') ? coreKeys : [abilityKey]
    const eventScopes = [
      ...new Map(
        scopes
          .filter((scope) => effectKeys.includes(scope.effectKey))
          .map((scope) => [scope.effectKey, scope]),
      ).values(),
    ]
    const refs = [
      ...new Set([
        ...contamination.sourceRefs,
        ...eventScopes.flatMap((scope) => scope.sourceRefs ?? []),
        ...sourceRefs,
      ]),
    ]
    projection.defs.push({
      providerAgentId: 'agent-roxy',
      referenceKey,
      label,
      valueKind: 'boolean',
      sourceRefs: refs,
    })
    projection.evidence.push({
      ...contamination,
      referenceKey,
      runtimeReference: referenceKey,
      unit: 'boolean_state',
      integerOnly: false,
      meaning: referenceKey.startsWith('roxyCoreWindow')
        ? '按属性独立声明历史50秒窗；重复触发刷新，净化不撤销此前窗口，风窗口只计算一次。不推测触发或到期时刻。'
        : '当前队员风蚀与当前污染匹配独立声明；不使用历史核心窗口推定追加能力。',
      effectKeys: [...effectKeys],
      eventScopes,
      sourceRefs: refs,
    })
  }
  contamination.effectKeys = contamination.effectKeys.filter((key) => !coreKeys.includes(key))
  contamination.eventScopes = contamination.eventScopes.filter(
    (scope) => !coreKeys.includes(scope.effectKey),
  )
  if (!contamination.effectKeys.length) {
    projection.evidence = projection.evidence.filter((row) => row !== contamination)
    projection.defs = projection.defs.filter(
      (row) => row.providerAgentId !== 'agent-roxy' || row.referenceKey !== 'contamination',
    )
  }
}

/** Overrides belong to one exact source entry; never rewrite shared contamination/windswept state. */
export function bindReviewedRoxyAttributeWindows32(input: {
  entry: CurrentAgentPlanningEffectBlueprint
  references?: Readonly<Record<string, unknown>>
  attribute: string
  windsweptObserved?: boolean
}) {
  const { entry, references = {}, attribute, windsweptObserved } = input
  const inactive = () => ({
    status: 'supported' as const,
    active: false,
    overrides: {} as Record<string, boolean>,
    sourceRefs: [] as string[],
  })
  if (
    entry.providerAgentId !== 'agent-roxy' ||
    ![...coreKeys, abilityKey].includes(entry.effectKey)
  )
    return inactive()
  if (predicates.every(([key]) => !Object.hasOwn(references, key))) return inactive()
  const unsupported = (reason: string) => ({ status: 'unsupported' as const, blockers: [reason] })
  if (!sourceMatches(entry)) return unsupported('洛克希属性窗口与锁定正文或表达式身份不一致。')
  if (
    predicates.some(
      ([key]) => !Object.hasOwn(references, key) || typeof references[key] !== 'boolean',
    )
  )
    return unsupported('洛克希逐次属性语义需要四个独立、明确的布尔声明。')
  if (!['wind', 'electric'].includes(attribute))
    return unsupported('洛克希逐次核心属性窗口仅核验风与电属性，不推定其它属性。')
  const wind = references.roxyCoreWindowWind32 as boolean
  const electric = references.roxyCoreWindowElectric32 as boolean
  const squad = references.roxySquadWindswept32 as boolean
  const matches = references.roxyContaminationMatchesEvent32 as boolean
  if (electric && !wind)
    return unsupported('电属性历史核心窗口生效时，风属性窗口不能同时声明未生效。')
  if ((squad || matches) && windsweptObserved === false)
    return unsupported('队员风蚀或当前污染匹配声明与敌人风蚀未生效观测矛盾。')
  if (entry.effectKey === abilityKey && typeof windsweptObserved !== 'boolean')
    return unsupported('洛克希追加能力需要当前敌人风蚀的明确观测。')
  const overrides =
    entry.effectKey === abilityKey
      ? { windswept: squad && windsweptObserved === true && (attribute === 'wind' || matches) }
      : { contamination: attribute === 'wind' ? wind : electric }
  return { status: 'supported' as const, active: true, overrides, sourceRefs: [...sourceRefs] }
}
