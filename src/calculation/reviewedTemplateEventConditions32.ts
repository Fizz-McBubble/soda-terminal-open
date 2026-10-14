import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { CommonAnomalyEventObservation32 } from './currentCommonAnomalyEffects32'
import { commonAnomalyEffectIdentity32 } from './currentPlanningEffectResolutionIdentity32'
import { reviewedTemplateMechanicEffectBlueprints32 } from './reviewedTemplateMechanicEffects32'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentDriveDiscFormulaData } from '../gameDataPacks/currentDriveDiscFormulaCatalog'

export type ReviewedTemplateEventConditionDeclaration32 = {
  /** Explicit fixed-event comparison preparation, never inferred from role/scenario. */
  sourceRefs: readonly string[]
  windswept?: boolean | null
  enemyStunned?: boolean | null
  sunnaDelusionApplied?: boolean | null
  nangongMisstepApplied?: boolean | null
  remiellePhaseFlow?: boolean | null
  /** Wearer's +10% CR buff is active, including the 15s after leaving a Veil. */
  whiteWaterBalladCritWindow?: boolean | null
  /** Wearer's activation/extension buff is active within its 30s duration. */
  whiteWaterBalladAttackWindow?: boolean | null
}

const and = (left: boolean | null | undefined, right: boolean | null | undefined) =>
  left === false || right === false ? false : left === true && right === true ? true : null

/** One explicit snapshot for these fixed events. Call separately for different
 * event/occurrence states; never smear a preparation across a rotation. */
export function prepareReviewedTemplateEventConditions32(input: {
  providerAgentId: string
  eventUsages: readonly PlanningEventUsage[]
  declaration: ReviewedTemplateEventConditionDeclaration32
}) {
  const { declaration } = input
  const gaps: string[] = []
  if (!declaration.sourceRefs.length || declaration.sourceRefs.some((ref) => !ref.trim()))
    gaps.push('明确事件准备态缺少声明来源。')
  for (const [name, value] of Object.entries(declaration))
    if (name !== 'sourceRefs' && value != null && typeof value !== 'boolean')
      gaps.push(`事件准备态必须为布尔或未知：${name}`)
  const hasWhiteWaterDeclaration =
    typeof declaration.whiteWaterBalladCritWindow === 'boolean' ||
    typeof declaration.whiteWaterBalladAttackWindow === 'boolean'
  const whiteWaterSource = hasWhiteWaterDeclaration
    ? getCurrentDriveDiscFormulaData('set-white-water-ballad')
    : null
  if (hasWhiteWaterDeclaration && !whiteWaterSource)
    gaps.push('沧浪行歌事件准备态缺少套装来源合同。')
  const references: Record<string, boolean> = {}
  const states: Record<string, boolean | null> = {}
  if (Object.hasOwn(declaration, 'windswept'))
    states.windswept = typeof declaration.windswept === 'boolean' ? declaration.windswept : null
  for (const name of ['whiteWaterBalladCritWindow', 'whiteWaterBalladAttackWindow'] as const)
    if (Object.hasOwn(declaration, name)) states[name] = declaration[name] ?? null
  const effects: string[] = []
  if (input.providerAgentId === 'agent-sunna') {
    states.sunnaDelusionStunWindow32 = and(
      declaration.sunnaDelusionApplied,
      declaration.enemyStunned,
    )
    effects.push('reviewed_delusion_stun32')
  }
  if (input.providerAgentId === 'agent-nangong') {
    states.nangongMisstep32 = and(declaration.nangongMisstepApplied, declaration.enemyStunned)
    effects.push('reviewed_misstep_stun32')
  }
  if (input.providerAgentId === 'agent-remielle') {
    states.remiellePhaseFlow32 =
      typeof declaration.remiellePhaseFlow === 'boolean' ? declaration.remiellePhaseFlow : null
    effects.push('reviewed_phase_flow_daze32')
  }
  for (const [name, value] of Object.entries(states))
    if (name !== 'windswept' && value !== null && !gaps.length) references[name] = value
  const sourceRefs = [
    ...new Set([
      ...declaration.sourceRefs,
      ...reviewedTemplateMechanicEffectBlueprints32
        .filter((entry) => effects.includes(entry.effectId))
        .flatMap((entry) => entry.sourceRefs),
      ...(typeof declaration.windswept === 'boolean'
        ? [`${commonAnomalyEffectIdentity32.path}#${commonAnomalyEffectIdentity32.sha256}`]
        : []),
      ...(whiteWaterSource
        ? [
            `${whiteWaterSource.fourPieceFormula.path}#sha256=${whiteWaterSource.fourPieceFormula.sha256}`,
          ]
        : []),
    ]),
  ]
  const commonAnomalyEvents: Record<string, CommonAnomalyEventObservation32[]> = {}
  if (typeof declaration.windswept === 'boolean' && !gaps.length)
    for (const usage of input.eventUsages)
      commonAnomalyEvents[`${usage.ownerAgentId}:${usage.eventId}`] = [
        { eventId: usage.eventId, windswept: declaration.windswept, sourceRefs },
      ]
  const boundary =
    '明确固定事件准备声明；妄想/失足仅在技能状态与敌人失衡同时成立时有效。Phase Flow当前仅接入来源失衡值容量，不提供积蓄循环、触发合法性、持续覆盖或实战DPS。' +
    (Object.hasOwn(declaration, 'whiteWaterBalladCritWindow') ||
    Object.hasOwn(declaration, 'whiteWaterBalladAttackWindow')
      ? ' 沧浪行歌分别声明佩戴者帷幕/离幕后15秒暴击窗及开启/延长帷幕后30秒增益窗；不从合光、队伍成员或敌人失衡推断触发。'
      : '')
  return {
    status: gaps.length ? ('unsupported' as const) : ('supported' as const),
    blockers: gaps,
    baselineReferences: references,
    states,
    commonAnomalyEvents,
    sourceRefs,
    whiteWaterBalladPreparation: {
      ...(typeof declaration.whiteWaterBalladCritWindow === 'boolean' && !gaps.length
        ? { critWindowActive: declaration.whiteWaterBalladCritWindow }
        : {}),
      ...(typeof declaration.whiteWaterBalladAttackWindow === 'boolean' && !gaps.length
        ? { attackWindowActive: declaration.whiteWaterBalladAttackWindow }
        : {}),
      sourceRefs,
    },
    boundary,
    identity: stableContentHash({
      providerAgentId: input.providerAgentId,
      eventUsages: input.eventUsages,
      declaration,
      states,
      sourceRefs,
      boundary,
    }),
  }
}
