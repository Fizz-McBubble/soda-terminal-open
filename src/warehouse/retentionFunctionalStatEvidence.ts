import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import type { UpstreamExpressionIR } from '../calculation/currentUpstreamExpressionIR'
import { effectReceivers, expressionReferences } from '../decision/teamStrengthSupportCapabilities'
import { stableContentHash } from '../gameDataPacks/types'
import type { RetentionUtilityEvidence } from './absoluteDiscRetentionUseFacts'
import { resolveReviewedFunctionalStatInput } from './reviewedFunctionalStatInputs'

export const retentionFunctionalStatEvidencePolicy = 'source-functional-stat-input-m0-p0-r2'
export type FunctionalStatContext = {
  mindscape: number
  potential: number
  flags: Readonly<Record<string, boolean>>
  /** A shield/heal formula is known but absent from the consumed effect IR. */
  unconsumedShieldOrHealing?: boolean
}
export const normalRetentionFunctionalContext: FunctionalStatContext = {
  mindscape: 0,
  potential: 0,
  flags: {},
}
const statNames: Record<string, readonly string[]> = {
  atk_: ['atk', 'atk_'],
  hp_: ['hp', 'hp_'],
  def_: ['def', 'def_'],
  anomProf: ['anomProf'],
  crit_: ['crit', 'crit_'],
  crit_dmg_: ['crit_dmg', 'crit_dmg_'],
}

type EffectContract = NonNullable<
  ReturnType<typeof getCurrentAgentDecisionMechanicContract>
>['effectContract']
type Projection = { ir: UpstreamExpressionIR; pending: string[]; unknown: boolean }
function project(expression: UpstreamExpressionIR, context: FunctionalStatContext): Projection {
  if (expression.kind !== 'call') {
    if (expression.kind === 'reference') return { ir: expression, pending: [], unknown: false }
    if (expression.kind === 'literal') return { ir: expression, pending: [], unknown: false }
    return { ir: expression, pending: [], unknown: true }
  }
  const args = expression.arguments
  const ref = args[0]?.kind === 'reference' ? args[0].path : null
  const limit = args[1]?.kind === 'literal' ? args[1].value : null
  const state =
    ref === 'char.mindscape'
      ? context.mindscape
      : ref === 'char.potential'
        ? context.potential
        : null
  if (
    state !== null &&
    typeof limit === 'number' &&
    ['cmpGE', 'cmpGT', 'cmpLT', 'cmpEq', 'cmpNE'].includes(expression.operator)
  ) {
    const yes =
      expression.operator === 'cmpGE'
        ? state >= limit
        : expression.operator === 'cmpGT'
          ? state > limit
          : expression.operator === 'cmpLT'
            ? state < limit
            : expression.operator === 'cmpEq'
              ? state === limit
              : state !== limit
    return project(args[yes ? 2 : 3] ?? { kind: 'literal', value: 0 }, context)
  }
  if (
    ['ifOn', 'ifOff'].includes(expression.operator) &&
    expression.receiver?.kind === 'reference'
  ) {
    const flag = expression.receiver.path,
      value = context.flags[flag]
    if (value !== undefined) {
      const enabled = expression.operator === 'ifOn' ? value : !value
      return project(args[enabled ? 0 : 1] ?? { kind: 'literal', value: 0 }, context)
    }
    const children = args.map((arg) => project(arg, context))
    return {
      ir:
        children.length === 1
          ? children[0]!.ir
          : { kind: 'array', items: children.map((child) => child.ir) },
      pending: [...children.flatMap((child) => child.pending), flag],
      unknown: children.some((child) => child.unknown),
    }
  }
  const children = args.map((arg) => project(arg, context))
  const known = new Set([
    'add',
    'addWithDmgType',
    'sum',
    'prod',
    'min',
    'max',
    'percent',
    'subscript',
    'cmpGE',
    'cmpGT',
    'cmpLT',
    'cmpEq',
    'cmpNE',
    'negate',
    'constant',
    // Existing shared IR operators count typed team categories; they do not read owner stats.
    'withFaction',
    'withSpecialty',
    'withAttribute',
  ])
  return {
    ir: { ...expression, arguments: children.map((child) => child.ir) },
    pending: [
      ...children.flatMap((child) => child.pending),
      ...(['cmpGE', 'cmpGT', 'cmpLT', 'cmpEq', 'cmpNE'].includes(expression.operator)
        ? [`source-predicate:${stableContentHash(args.slice(0, 2))}`]
        : []),
    ],
    unknown: !known.has(expression.operator) || children.some((child) => child.unknown),
  }
}

/** Tests read-input dependencies, not the stat that a constant buff happens to grant. */
export function resolveRetentionFunctionalStatEvidence(input: {
  agentId: string
  effectStat: string
  context?: FunctionalStatContext
  contract?: EffectContract | null
}): RetentionUtilityEvidence & { fingerprint: string; sourceLocators: string[] } {
  const context = input.context ?? normalRetentionFunctionalContext
  const contract =
    input.contract === undefined
      ? getCurrentAgentDecisionMechanicContract(input.agentId)?.effectContract
      : input.contract
  const event = getCurrentAgentEventContract(input.agentId)
  const source = event?.source
  const names = statNames[input.effectStat]
  const evidenceIds = source
    ? [`${source.repository}:${source.commit}:${source.formulaSha256}`]
    : []
  const matches: Array<{ locator: string; pending: string[] }> = []
  const bindingValid = Boolean(
    contract &&
    names &&
    source &&
    /^[a-f0-9]{40}$/.test(source.commit) &&
    /^[A-F0-9]{64}$/.test(source.formulaSha256) &&
    contract.externalId === event?.externalId,
  )
  const contextValid =
    Number.isInteger(context.mindscape) &&
    context.mindscape >= 0 &&
    context.mindscape <= 6 &&
    Number.isInteger(context.potential) &&
    context.potential >= 0 &&
    context.potential <= 6 &&
    Object.values(context.flags).every((value) => typeof value === 'boolean')
  let incomplete = !bindingValid || !contextValid
  const readsInput = (ir: UpstreamExpressionIR) =>
    expressionReferences(ir).some((path) =>
      names?.some((name) =>
        new RegExp(
          `^own\\.(?:final|initial|premod|base)\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        ).test(path),
      ),
    )
  for (const functional of contract?.functionalInputs ?? []) {
    const numeric = functional.numericExpression
    if (
      !numeric.expressionIrReady ||
      numeric.todoFlagged ||
      numeric.classification !== 'upstream_expression_available' ||
      !/^[A-F0-9]{64}$/.test(numeric.expressionSha256 ?? '') ||
      !functional.locator
    ) {
      incomplete = true
      continue
    }
    const projected = project(numeric.expressionIr as UpstreamExpressionIR, context)
    if (projected.unknown) {
      incomplete = true
      continue
    }
    if (readsInput(projected.ir)) {
      matches.push({ locator: functional.locator, pending: projected.pending })
      evidenceIds.push(`functional-expression:${numeric.expressionSha256}`)
    }
  }
  for (const effect of contract?.effects ?? []) {
    if (/^m([1-6])(?:_|$)/i.test(effect.effectId) && context.mindscape < Number(effect.effectId[1]))
      continue
    if (/^potential/i.test(effect.effectId) && context.potential === 0) continue
    const numeric = effect.numericExpression
    if (
      !numeric.expressionIrReady ||
      numeric.todoFlagged ||
      numeric.classification !== 'upstream_expression_available' ||
      !/^[A-F0-9]{64}$/.test(numeric.expressionSha256 ?? '') ||
      !effect.locator ||
      !numeric.expressionIr
    ) {
      incomplete = true
      continue
    }
    const projected = project(numeric.expressionIr as UpstreamExpressionIR, context)
    const receivers = effectReceivers(projected.ir)
    const functional = receivers.some(
      (receiver) =>
        /^(?:teamBuff|notOwnBuff|enemyDebuff)\./.test(receiver.path) ||
        /^(?:ownBuff)\..*(?:shield|heal|healing|recovery|sheerForce)/i.test(receiver.path),
    )
    if (!functional) continue
    if (projected.unknown) {
      incomplete = true
      continue
    }
    // The receiver is excluded: granting team ATK is not proof of reading the owner's ATK.
    const refs =
      projected.ir.kind === 'call'
        ? projected.ir.arguments.flatMap(expressionReferences)
        : expressionReferences(projected.ir)
    if (
      refs.some((path) =>
        names?.some((name) =>
          new RegExp(
            `^own\\.(?:final|initial|premod|base)\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          ).test(path),
        ),
      )
    ) {
      matches.push({ locator: effect.locator, pending: projected.pending })
      evidenceIds.push(`functional-expression:${numeric.expressionSha256}`)
    }
  }
  const pending = matches.flatMap((match) => match.pending)
  const unconsumed =
    input.effectStat === 'atk_' && context.unconsumedShieldOrHealing && !matches.length
  const state =
    !bindingValid ||
    !contextValid ||
    contract?.source.commit !== source?.commit ||
    contract?.source.formulaSha256 !== source?.formulaSha256
      ? 'missing_fact'
      : matches.length
        ? pending.length
          ? 'conditional'
          : 'valid'
        : incomplete || unconsumed
          ? 'missing_fact'
          : 'incidental'
  const core = {
    policy: retentionFunctionalStatEvidencePolicy,
    agentId: input.agentId,
    effectStat: input.effectStat,
    source,
    context,
    state,
    sourceLocators: matches.map((match) => match.locator),
    pending,
  }
  if (
    state === 'missing_fact' &&
    bindingValid &&
    contextValid &&
    input.contract === undefined &&
    contract?.source.commit === source?.commit &&
    contract?.source.formulaSha256 === source?.formulaSha256
  ) {
    const reviewed = resolveReviewedFunctionalStatInput({
      agentId: input.agentId,
      effectStat: input.effectStat,
      mindscape: context.mindscape,
      potential: context.potential,
      flags: context.flags,
    })
    if (reviewed.state !== 'missing_fact') {
      return {
        ...reviewed,
        evidenceIds: [...new Set([...evidenceIds, ...reviewed.evidenceIds])],
        fingerprint: stableContentHash({ primary: core, reviewed: reviewed.fingerprint }),
      }
    }
  }
  return {
    state,
    predicateId: `${retentionFunctionalStatEvidencePolicy}:${input.effectStat}`,
    evidenceIds: [...new Set(evidenceIds)],
    detail:
      state === 'valid'
        ? '当前来源表达式证明该词条是功能效果的读取输入。'
        : state === 'conditional'
          ? `功能输入已由来源表达式证明；仍需核对事件条件：${[...new Set(pending)].join('、')}。`
          : state === 'missing_fact'
            ? '功能效果表达式或参数尚未完整消费，不能把攻略推荐认定为功能主目标。'
            : '已核对当前功能效果表达式，没有读取该词条的功能依赖；普通自身伤害或副目标推荐仅为附带用途。',
    fingerprint: stableContentHash(core),
    sourceLocators: core.sourceLocators,
  }
}
