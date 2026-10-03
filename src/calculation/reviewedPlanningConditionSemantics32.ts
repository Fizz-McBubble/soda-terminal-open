import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { bindPlanningEffectRuntimePotentialReference } from './currentPlanningEffectDomain'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { PlanningConditionProjection32 } from './currentPlanningConditionCatalog32'
import { reviewedPlanningConditionSemanticsIdentity32 as identity } from './reviewedPlanningConditionSemanticsIdentity32'

const sourceRefs = (source: typeof identity.rina | typeof identity.koleda) => [
  `https://github.com/frzyc/genshin-optimizer@${identity.commit}`,
  `${source.formulaPath}#sha256=${source.formulaSha256}`,
  `${source.localizationPath}#sha256=${source.localizationSha256}`,
]

const consumedStackEffects = ['agent-koleda:basic_dmg_', 'agent-koleda:basic_dazeInc_']
const hasKoledaPotential = (potential?: number | null) =>
  Number(
    bindPlanningEffectRuntimePotentialReference({
      agentId: 'agent-koleda',
      potential,
      references: {},
    })['char.potential'],
  ) >= 1

/** Keep stack inventory, consumed amount and individual dolls separate from activation. */
export function applyReviewedPlanningConditionDomains32(projection: PlanningConditionProjection32) {
  const doll = projection.evidence.find(
    (row) => row.providerAgentId === 'agent-rina' && row.referenceKey === 'minions_onField',
  )
  if (doll) {
    projection.defs = projection.defs.filter(
      (row) => row.providerAgentId !== 'agent-rina' || row.referenceKey !== 'minions_onField',
    )
    projection.evidence = projection.evidence.filter((row) => row !== doll)
    for (const [referenceKey, label] of [
      ['drusillaNotReturned32', '杜拉尚未返回'],
      ['anastellaNotReturned32', '安娜尚未返回'],
    ]) {
      const refs = [...new Set([...doll.sourceRefs, ...sourceRefs(identity.rina)])]
      projection.defs.push({
        providerAgentId: 'agent-rina',
        referenceKey: referenceKey!,
        label: label!,
        valueKind: 'boolean',
        sourceRefs: refs,
      })
      projection.evidence.push({
        ...doll,
        referenceKey: referenceKey!,
        runtimeReference: referenceKey!,
        meaning: '逐次声明各自尚未返回；核心穿透取OR，四影回能取AND。',
        sourceRefs: refs,
      })
    }
  }
  const inventory = projection.evidence.find(
    (row) => row.providerAgentId === 'agent-koleda' && row.referenceKey === 'furnaceFire',
  )
  if (inventory) {
    const scopes = inventory.eventScopes.filter(
      (row) => row.effectKey === 'agent-koleda:basic_common_dmg_',
    )
    const consumedScopes = inventory.eventScopes.filter((row) =>
      consumedStackEffects.includes(row.effectKey),
    )
    const reboundKeys = ['agent-koleda:basic_common_dmg_', ...consumedStackEffects]
    inventory.effectKeys = inventory.effectKeys.filter((key) => !reboundKeys.includes(key))
    inventory.eventScopes = inventory.eventScopes.filter(
      (row) => !reboundKeys.includes(row.effectKey),
    )
    const refs = [...new Set([...inventory.sourceRefs, ...sourceRefs(identity.koleda)])]
    if (consumedScopes.length) {
      projection.defs.push({
        providerAgentId: 'agent-koleda',
        referenceKey: 'furnaceConsumedStacks32',
        label: '该次增强普攻第二击消耗的炉火层数',
        valueKind: 'number',
        minimum: 0,
        maximum: 2,
        sourceRefs: refs,
      })
      projection.evidence.push({
        ...inventory,
        referenceKey: 'furnaceConsumedStacks32',
        runtimeReference: 'furnaceConsumedStacks32',
        unit: 'integer_stack',
        integerOnly: true,
        meaning: '仅用于本次增强普攻第二击消耗量快照；不是消耗后的库存或40秒窗口。',
        effectKeys: [...consumedStackEffects],
        eventScopes: consumedScopes,
        sourceRefs: refs,
      })
    }
    projection.defs.push({
      providerAgentId: 'agent-koleda',
      referenceKey: 'furnaceConsumptionBuffActive32',
      label: '消耗炉火后的40秒队伍增伤仍生效',
      valueKind: 'boolean',
      sourceRefs: refs,
    })
    projection.evidence.push({
      ...inventory,
      referenceKey: 'furnaceConsumptionBuffActive32',
      runtimeReference: 'furnaceConsumptionBuffActive32',
      unit: 'boolean_state',
      integerOnly: false,
      meaning: '已消耗炉火且40秒窗口未结束；重复触发重置时长。库存层数不能证明该窗口。',
      effectKeys: ['agent-koleda:basic_common_dmg_'],
      eventScopes: scopes,
      sourceRefs: refs,
    })
    if (!inventory.effectKeys.length) {
      projection.defs = projection.defs.filter(
        (row) => row.providerAgentId !== 'agent-koleda' || row.referenceKey !== 'furnaceFire',
      )
      projection.evidence = projection.evidence.filter((row) => row !== inventory)
    }
  }
}

/** Rebind only the exact reviewed expression's predicate; never change global
 * inventory or doll state and never bypass account potential/mindscape gates. */
export function bindReviewedPlanningConditionSemantics32(input: {
  entry: CurrentAgentPlanningEffectBlueprint
  references?: Readonly<Record<string, unknown>>
  potential?: number | null
  event?: { ownerAgentId: string; eventModifierRefs?: readonly string[] }
}) {
  const { entry, references = {} } = input
  let overrides: Record<string, boolean | number> = {}
  let source: typeof identity.rina | typeof identity.koleda | undefined
  if (
    entry.providerAgentId === 'agent-rina' &&
    Object.hasOwn(identity.rina.expressions, entry.effectKey)
  ) {
    const first = references.drusillaNotReturned32
    const second = references.anastellaNotReturned32
    if (first === undefined && second === undefined)
      return { status: 'supported' as const, active: false, overrides, sourceRefs: [] as string[] }
    if (typeof first !== 'boolean' || typeof second !== 'boolean')
      return { status: 'unsupported' as const, blockers: ['丽娜逐次效果需要两个独立傀儡状态。'] }
    source = identity.rina
    overrides = {
      minions_onField:
        entry.effectKey === 'agent-rina:core_pen_' ? first || second : first && second,
    }
  } else if (
    entry.providerAgentId === 'agent-koleda' &&
    consumedStackEffects.includes(entry.effectKey)
  ) {
    if (
      input.event?.ownerAgentId !== entry.providerAgentId ||
      !input.event.eventModifierRefs?.includes(entry.effectId)
    )
      return { status: 'supported' as const, active: false, overrides, sourceRefs: [] as string[] }
    const consumed = references.furnaceConsumedStacks32
    if (hasKoledaPotential(input.potential)) {
      if (consumed === undefined)
        return {
          status: 'unsupported' as const,
          blockers: ['珂蕾妲增强普攻缺少该次消耗的炉火层数；库存层数不能替代。'],
        }
      if (
        typeof consumed !== 'number' ||
        !Number.isInteger(consumed) ||
        consumed < 0 ||
        consumed > 2
      )
        return {
          status: 'unsupported' as const,
          blockers: ['珂蕾妲该次炉火消耗层数必须为0至2的整数。'],
        }
    }
    source = identity.koleda
    overrides = { furnaceFire: hasKoledaPotential(input.potential) ? Number(consumed) : 0 }
  } else if (
    entry.effectKey === 'agent-koleda:basic_common_dmg_' &&
    entry.providerAgentId === 'agent-koleda'
  ) {
    const active = references.furnaceConsumptionBuffActive32
    if (active === undefined)
      return hasKoledaPotential(input.potential)
        ? {
            status: 'unsupported' as const,
            blockers: ['珂蕾妲潜能队伍增伤缺少炉火消耗窗口；库存层数不能替代。'],
          }
        : { status: 'supported' as const, active: false, overrides, sourceRefs: [] as string[] }
    if (typeof active !== 'boolean')
      return {
        status: 'unsupported' as const,
        blockers: ['珂蕾妲队伍增伤需要明确的炉火消耗窗口状态。'],
      }
    source = identity.koleda
    // The pinned subtree compares this operand only to 1. This local gate is
    // not a fabricated inventory stack and cannot feed any other expression.
    overrides = { furnaceFire: active ? 1 : 0 }
  }
  if (!source)
    return { status: 'supported' as const, active: false, overrides, sourceRefs: [] as string[] }
  const contract = getCurrentAgentEventContract(entry.providerAgentId)
  const hashes: Readonly<Record<string, string>> = source.expressions
  const hash = hashes[entry.effectKey]
  if (
    !contract ||
    contract.source.commit !== identity.commit ||
    contract.source.formulaPath !== source.formulaPath ||
    contract.source.formulaSha256 !== source.formulaSha256 ||
    entry.numericExpression.expressionSha256 !== hash ||
    !entry.sourceRefs.includes(`${source.formulaPath}#${source.formulaSha256}`)
  )
    return {
      status: 'unsupported' as const,
      blockers: ['逐次条件语义与锁定表达式或正文来源不一致。'],
    }
  return { status: 'supported' as const, active: true, overrides, sourceRefs: sourceRefs(source) }
}
