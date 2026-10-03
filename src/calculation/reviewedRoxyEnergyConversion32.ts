import { reviewedRoxyEnergyConversionIdentity32 } from './currentPlanningEffectResolutionIdentity32'
export { reviewedRoxyEnergyConversionIdentity32 } from './currentPlanningEffectResolutionIdentity32'

/** Named semantic correction only. Keep the pinned expression, threshold and caps. */
export function bindReviewedRoxyEnergyConversion32(input: {
  agentId: string
  effectId: string
  coreLevel: number
  source: { commit: string; formulaSha256: string }
  expressionSha256: string
  references: Readonly<Record<string, unknown>>
}) {
  const identity = reviewedRoxyEnergyConversionIdentity32
  if (input.agentId !== 'agent-roxy' || !['core_atk', 'core_impact'].includes(input.effectId))
    return {
      status: 'supported' as const,
      references: input.references,
      sourceRefs: [] as string[],
    }
  const effectId = input.effectId as keyof typeof identity.expressionHashes
  const expectedCaps =
    effectId === 'core_atk' ? [480, 560, 640, 720, 800, 880, 960] : [40, 46, 52, 58, 64, 70, 76.8]
  const caps = input.references[effectId === 'core_atk' ? 'dm.core.maxAtk' : 'dm.core.maxImpact']
  if (
    input.source.commit !== identity.commit ||
    input.source.formulaSha256 !== identity.formulaSha256 ||
    input.expressionSha256 !== identity.expressionHashes[effectId] ||
    input.references['dm.core.enerRegenStep'] !== 0.01 ||
    input.references['dm.core.initEnerRegen'] !== 1.2 ||
    input.references[effectId === 'core_atk' ? 'dm.core.atk' : 'dm.core.impact'] !==
      (effectId === 'core_atk' ? 5 : 0.4) ||
    !Array.isArray(caps) ||
    caps.length !== expectedCaps.length ||
    caps.some((value, index) => value !== expectedCaps[index])
  )
    return {
      status: 'unsupported' as const,
      blockers: ['Roxy ER单位修正的锁定源参数或表达式身份已改变。'],
    }
  if (
    !Number.isInteger(input.coreLevel) ||
    input.coreLevel < 1 ||
    input.coreLevel > 7 ||
    input.references['char.core'] !== input.coreLevel - 1
  )
    return {
      status: 'unsupported' as const,
      blockers: ['Roxy ER转换需明确核心等级1至7；1为源第一行未提升基准，未知不能推定。'],
    }
  const er = input.references['own.initial.enerRegen']
  if (typeof er !== 'number' || !Number.isFinite(er) || er < 0)
    return { status: 'unsupported' as const, blockers: ['Roxy ER转换缺少有限的完整初始能量回复。'] }
  return {
    status: 'supported' as const,
    references: { ...input.references, 'dm.core.enerRegenStep': 1 / 0.01 },
    sourceRefs: [
      `semantic-overlay:${identity.revision}`,
      `${identity.localizationPath}#${identity.localizationSha256}`,
      `${identity.formulaPath}#${identity.formulaSha256}`,
      identity.corroboration,
    ],
  }
}
