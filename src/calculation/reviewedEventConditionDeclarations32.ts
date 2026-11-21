import { z } from 'zod'
import { preparedYanagiPolaritySchema32 } from './reviewedPreparedPolarityDeclaration32'
import { personalOrdinaryAnomalyDeclarationSchema32 } from './personalOrdinaryAnomalyDeclaration32'
import { personalPhoenixAbloomDeclarationSchema33 } from './personalPhoenixAbloomDeclaration33'
import { personalMiyabiShimotsukiDeclarationSchema32 } from './personalMiyabiShimotsukiDeclaration32'
import { personalFunctionalConditionsSchema32 } from './personalFunctionalConditions32'
import { stableContentHash } from '../domain/stableContentHash'
import type { ReviewedTemplateEventConditionDeclaration32 } from './reviewedTemplateEventConditions32'
import {
  reviewedTargetEffectStateSchema32,
  reviewedTargetEffectSnapshotSchema32,
} from '../domain/reviewedTargetEffectState32'

export type ReviewedEventConditionDeclarations32 = Readonly<
  Record<string, ReviewedTemplateEventConditionDeclaration32>
>

const state = z.boolean().nullable().optional()
export const reviewedEventConditionDeclarationSchema32 = z
  .object({
    sourceRefs: z.array(z.string().trim().min(1)).min(1),
    windswept: state,
    enemyStunned: state,
    sunnaDelusionApplied: state,
    nangongMisstepApplied: state,
    remiellePhaseFlow: state,
    whiteWaterBalladCritWindow: state,
    whiteWaterBalladAttackWindow: state,
    steelCushionHitBehind: state,
    firstPlumageAnomalyCritWindowActive: state,
    yanagiPolarity: preparedYanagiPolaritySchema32.optional(),
    personalOrdinaryAnomaly: personalOrdinaryAnomalyDeclarationSchema32.optional(),
    phoenixOwnFireAbloom: personalPhoenixAbloomDeclarationSchema33.optional(),
    miyabiShimotsuki: personalMiyabiShimotsukiDeclarationSchema32.optional(),
    personalFunctionalConditions32: personalFunctionalConditionsSchema32.optional(),
    personalSupportPreparation32: z
      .object({
        zhaoAdditionalAbilityActive: state,
        zhaoInsideEtherVeil: state,
        sunnaAngelicChordActive: state,
        luciaDarkbreaker: state,
      })
      .strict()
      .optional(),
    ye: z
      .object({
        yeShunguangUnity32: z.boolean().optional(),
        yeShunguangEnlightenedMind32: z.boolean().optional(),
        yeShunguangPaidChasingStorms32: z.boolean().optional(),
        yeShunguangVerdictActive32: z.boolean().optional(),
        yeShunguangVerdictTargetInside32: z.boolean().optional(),
        yeShunguangVerdictAtCap32: z.boolean().optional(),
        yeShunguangVerdictVulnerability32: z.number().finite().nonnegative().optional(),
      })
      .strict()
      .optional(),
    zhao: z
      .object({
        zhaoM1SwitchedOut32: z.boolean().optional(),
        zhaoM1SecondsSinceSwitchOut32: z.number().finite().nonnegative().optional(),
      })
      .strict()
      .optional(),
    targetEffectState32: reviewedTargetEffectStateSchema32.nullable().optional(),
    targetEffectSnapshot32: reviewedTargetEffectSnapshotSchema32.nullable().optional(),
  })
  .strict()
export const reviewedEventConditionDeclarationsSchema32 = z.record(
  z.string().trim().min(1),
  reviewedEventConditionDeclarationSchema32,
)

/** Shared query/save vocabulary. Unknown fields and invalid states never activate effects. */
export function normalizeReviewedEventConditionDeclarations32(
  raw: unknown,
  memberIds?: readonly string[],
): ReviewedEventConditionDeclarations32 | undefined {
  if (raw === undefined) return undefined
  const parsed = reviewedEventConditionDeclarationsSchema32.safeParse(raw)
  if (!parsed.success) throw new Error('技能事件声明格式无效，请重新比较；原方案仍保留。')
  const entries = Object.entries(parsed.data).sort(([a], [b]) => a.localeCompare(b))
  if (memberIds && entries.some(([id]) => !memberIds.includes(id)))
    throw new Error('技能事件声明与当前代理人不一致，请重新比较。')
  if (!entries.length) return undefined
  return Object.fromEntries(
    entries.map(([id, declaration]) => [
      id,
      {
        ...declaration,
        sourceRefs: [...new Set(declaration.sourceRefs)].sort(),
      },
    ]),
  )
}

export function reviewedEventConditionDeclarationsIdentity32(raw: unknown): string | undefined {
  const normalized = normalizeReviewedEventConditionDeclarations32(raw)
  return normalized ? stableContentHash(normalized) : undefined
}

/** Historical malformed declarations remain viewable, but cannot reuse a valid result. */
export function savedReviewedEventConditionDeclarationsIdentity32(
  raw: unknown,
): string | undefined {
  try {
    return reviewedEventConditionDeclarationsIdentity32(raw)
  } catch {
    return 'invalid-event-condition-declarations32'
  }
}
