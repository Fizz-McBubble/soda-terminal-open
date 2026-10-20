import { stableContentHash } from '../gameDataPacks/types'
import { resolveCurrentAgentEvent } from './currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import {
  reviewedTemplateMechanicEffectBlueprints32,
  reviewedTemplateMechanicSource32,
} from './reviewedTemplateMechanicEffects32'
import { requiredReferences } from './currentPlanningEffectExpressions'
import {
  prepareReviewedTemplateEventConditions32,
  type ReviewedTemplateEventConditionDeclaration32,
} from './reviewedTemplateEventConditions32'

// Neutral comparison retains eight established windows and Lucia's explicit
// ordinary-contact coordinate (without a Harmony final-hit bonus). Conditional
// enemy/anomaly/phase preparation is opt-in and never defaults to active.
const windows: Readonly<Record<string, readonly string[]>> = {
  'agent-lucia': ['luciaHarmonyFinalHit32'],
  'agent-sigrid': ['sigridAerialPatrolCritWindow32'],
  'agent-sunna': ['sunnaAngelicChordination32'],
  'agent-nangong': ['nangongCoreHitWindow32'],
  'agent-cissia': ['cissiaVenomBuffWindow32'],
  'agent-ye-shunguang': ['yeShunguangUnity32'],
  'agent-pyrois': ['pyroisSunflare32'],
  'agent-norma': ['normaEnNahBarrage32'],
  'agent-zhao': ['zhaoWellspringAttackWindow32'],
}

export function reviewedTemplateWindowStateNames32(agentId: string) {
  return windows[agentId] ?? []
}

/** This comparison counts ordinary contacts with no Harmony final-hit bonus.
 * It is an explicit neutral coordinate, not an inferred game/account state. */
export const normalizedLuciaEventReferences32 = Object.freeze({ luciaHarmonyFinalHit32: false })

/** Only the normal candidate fixed-event consumers opt into this policy.
 * Each counted event is declared inside the named source window, independently;
 * this does not prove uptime, triggers, resource legality, a rotation or DPS.
 * Source expressions and actual squad ability gates remain the numeric authority.
 */
export function prepareReviewedTemplateEvents32(input: {
  member: Pick<PlanningEffectRuntimeMember, 'agentId'>
  eventUsages: readonly PlanningEventUsage[]
  references?: Readonly<Record<string, unknown>>
  conditionDeclaration?: ReviewedTemplateEventConditionDeclaration32
}) {
  const conditionPreparation = input.conditionDeclaration
    ? prepareReviewedTemplateEventConditions32({
        providerAgentId: input.member.agentId,
        eventUsages: input.eventUsages,
        declaration: input.conditionDeclaration,
      })
    : null
  const stateNames = reviewedTemplateWindowStateNames32(input.member.agentId)
  if (!stateNames.length && !conditionPreparation) return null
  const ownEvents = input.eventUsages.filter((event) => event.ownerAgentId === input.member.agentId)
  if (
    !ownEvents.length ||
    ownEvents.some(
      (event) =>
        resolveCurrentAgentEvent({
          stableId: event.ownerAgentId,
          eventId: event.eventId,
          skillLevel: event.skillLevel,
        }).status !== 'supported',
    )
  )
    return null
  const policyId = 'reviewed-template-per-event-window-comparison-r1'
  const entries = reviewedTemplateMechanicEffectBlueprints32.filter(
    (entry) =>
      entry.providerAgentId === input.member.agentId &&
      stateNames.some((name) =>
        requiredReferences(entry.numericExpression.expressionIr).includes(name),
      ),
  )
  const sourceRefs = [
    ...new Set([
      ...entries.flatMap((entry) => entry.sourceRefs),
      ...(input.member.agentId === 'agent-lucia'
        ? [
            `libs/zzz/dm-localization/assets/locales/en/char_Lucia_gen.json#sha256=${reviewedTemplateMechanicSource32.localizationHashes.Lucia}`,
          ]
        : []),
      ...(conditionPreparation?.sourceRefs ?? []),
    ]),
  ]
  const baselineReferences = { ...input.references }
  // These are conjunctive skill+enemy windows. Only the explicit declaration
  // helper may bind them here; a generic character flag cannot prove triggers.
  for (const name of ['sunnaDelusionStunWindow32', 'nangongMisstep32', 'remiellePhaseFlow32'])
    delete baselineReferences[name]
  Object.assign(baselineReferences, conditionPreparation?.baselineReferences)
  for (const name of stateNames) {
    // Explicit false, null, undefined or other missing-evidence overrides win.
    if (!Object.hasOwn(baselineReferences, name)) {
      if (name === 'luciaHarmonyFinalHit32')
        baselineReferences[name] = normalizedLuciaEventReferences32.luciaHarmonyFinalHit32
      else baselineReferences[name] = true
    }
  }
  const teamWindow = entries.some((entry) => entry.targetKinds.includes('team'))
  const declarations = input.eventUsages
    .filter((event) => teamWindow || event.ownerAgentId === input.member.agentId)
    .map((event) => ({
      providerAgentId: input.member.agentId,
      ownerAgentId: event.ownerAgentId,
      eventId: event.eventId,
      skillLevel: event.skillLevel,
      occurrenceCount: event.occurrenceCount,
      states: {
        ...Object.fromEntries(stateNames.map((name) => [name, baselineReferences[name]])),
        ...conditionPreparation?.states,
      },
      policyId,
      sourceRefs,
    }))
  const excludedWindow =
    !conditionPreparation && input.member.agentId === 'agent-sunna'
      ? ' 未声明sunnaDelusionStunWindow32敌人失衡窗。'
      : !conditionPreparation && input.member.agentId === 'agent-nangong'
        ? ' 未声明nangongMisstep32敌人失衡窗。'
        : ''
  const boundary =
    '逐事件窗口比较准备态：每个被计事件声明位于对应来源核心/增益有效窗内；非当前实战观测，不证明触发频率、连续覆盖、资源合法性、真实轮转或DPS。' +
    excludedWindow +
    (input.member.agentId === 'agent-lucia'
      ? ' 卢西娅默认比较明确不计Harmony终击额外伤害；显式事件状态优先。'
      : '')
  return {
    policyId,
    baselineReferences,
    declarations,
    sourceRefs,
    boundary: boundary + (conditionPreparation?.boundary ?? ''),
    ...(conditionPreparation
      ? { conditionPreparation, commonAnomalyEvents: conditionPreparation.commonAnomalyEvents }
      : {}),
    identity: stableContentHash({
      policyId,
      declarations,
      boundary,
      ...(conditionPreparation ? { conditions: conditionPreparation.identity } : {}),
    }),
  }
}
