import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { CommonAnomalyEventObservation32 } from './currentCommonAnomalyEffects32'
import { commonAnomalyEffectIdentity32 } from './currentPlanningEffectResolutionIdentity32'
import { reviewedTemplateMechanicEffectBlueprints32 } from './reviewedTemplateMechanicEffects32'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentDriveDiscFormulaData } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import {
  declareReviewedYeShunguangEventConditions32,
  type ReviewedYeShunguangEventConditions32,
  type ReviewedZhaoM1EventConditions32,
} from './reviewedYeShunguangEventConditions32'
import { reviewedYeShunguangEventSourceRefs32 } from './reviewedYeShunguangEventIdentity32'
import {
  bindReviewedAnomalyPartyState32,
  type ReviewedTargetEffectState32,
  type ReviewedTargetEffectSnapshot32,
} from './reviewedAnomalyPartyState32'

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
  /** Explicit fixed-event Steel Cushion hit direction; null or omitted is unknown. */
  steelCushionHitBehind?: boolean | null
  /** Wearer's First Plumage Fire DMG window triggered by team anomaly crits; not a CR stat. */
  firstPlumageAnomalyCritWindowActive?: boolean | null
  targetEffectState32?: ReviewedTargetEffectState32 | null
  targetEffectSnapshot32?: ReviewedTargetEffectSnapshot32 | null
  ye?: ReviewedYeShunguangEventConditions32
  zhao?: ReviewedZhaoM1EventConditions32
  yanagiPolarity?: import('./reviewedPreparedPolarityDeclaration32').PreparedYanagiPolarity32
  personalOrdinaryAnomaly?: import('./personalOrdinaryAnomalyDeclaration32').PersonalOrdinaryAnomalyDeclaration32
  phoenixOwnFireAbloom?: import('./personalPhoenixAbloomDeclaration33').PersonalPhoenixAbloomDeclaration33
  miyabiShimotsuki?: import('./personalMiyabiShimotsukiDeclaration32').PersonalMiyabiShimotsukiDeclaration32
  personalFunctionalConditions32?: import('./personalFunctionalConditions32').PersonalFunctionalConditions32
  personalSupportPreparation32?: {
    zhaoAdditionalAbilityActive?: boolean | null
    zhaoInsideEtherVeil?: boolean | null
    sunnaAngelicChordActive?: boolean | null
    luciaDarkbreaker?: boolean | null
  }
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
    if (
      ![
        'sourceRefs',
        'targetEffectState32',
        'targetEffectSnapshot32',
        'ye',
        'zhao',
        'yanagiPolarity',
        'personalOrdinaryAnomaly',
        'phoenixOwnFireAbloom',
        'personalSupportPreparation32',
        'miyabiShimotsuki',
        'personalFunctionalConditions32',
      ].includes(name) &&
      value != null &&
      typeof value !== 'boolean'
    )
      gaps.push(`事件准备态必须为布尔或未知：${name}`)
  const hasWhiteWaterDeclaration =
    typeof declaration.whiteWaterBalladCritWindow === 'boolean' ||
    typeof declaration.whiteWaterBalladAttackWindow === 'boolean'
  const whiteWaterSource = hasWhiteWaterDeclaration
    ? getCurrentDriveDiscFormulaData('set-white-water-ballad')
    : null
  if (hasWhiteWaterDeclaration && !whiteWaterSource)
    gaps.push('沧浪行歌事件准备态缺少套装来源合同。')
  const references: Record<string, unknown> = {}
  const states: Record<string, boolean | number | null> = {}
  const declaredEvents = declareReviewedYeShunguangEventConditions32(declaration)
  if (declaredEvents.some((event) => event.providerAgentId !== input.providerAgentId))
    gaps.push('事件条件主体与当前声明代理人不一致。')
  if (
    declaredEvents.some(
      (event) =>
        typeof event.value === 'string' ||
        (typeof event.value === 'number' && !Number.isFinite(event.value)),
    )
  )
    gaps.push('事件条件必须为明确布尔或有限数值。')
  if (!gaps.length)
    for (const event of declaredEvents)
      if (typeof event.value !== 'string') {
        states[event.referenceKey] = event.value
        references[event.referenceKey] = event.value
      }
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
  if (declaration.targetEffectState32 != null) {
    const bound = bindReviewedAnomalyPartyState32({
      providerAgentId: input.providerAgentId,
      references: {
        reviewedTargetEffectState32: declaration.targetEffectState32,
      },
      snapshot: declaration.targetEffectSnapshot32 ?? undefined,
    })
    if (bound.status !== 'supported') gaps.push(...bound.blockers)
    else if (!gaps.length) {
      Object.assign(references, bound.references)
      const names: Record<string, string> = {
        'agent-promeia': 'promeiaGuiltyAbloom32',
        'agent-sunna': 'sunnaCatGazeStacks32',
        'agent-nangong': 'nangongMisstep32',
      }
      const name = names[input.providerAgentId]
      if (name) states[name] = bound.state
      effects.push(
        ...reviewedTemplateMechanicEffectBlueprints32
          .filter((entry) => entry.providerAgentId === input.providerAgentId)
          .map((entry) => entry.effectId),
      )
    }
  }
  const sourceRefs = [
    ...new Set([
      ...declaration.sourceRefs,
      ...(declaredEvents.length ? reviewedYeShunguangEventSourceRefs32(input.providerAgentId) : []),
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
        {
          eventId: usage.eventId,
          windswept: declaration.windswept,
          sourceRefs,
        },
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
