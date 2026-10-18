import { stableContentHash } from '../gameDataPacks/types'

export const reviewedLumifluxMechanicsIdentity32 = Object.freeze({
  revision: 'remielle-refringe-luminize-source-contract-r2',
  gameVersion: '3.2',
  source: {
    repository: 'frzyc/genshin-optimizer',
    commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
    license: 'MIT',
    localizationPath: 'libs/zzz/dm-localization/assets/locales/en/char_Remielle_gen.json',
    localizationSha256: '3A9DE7B70DE53DE6316D7D85728A28DAD51A4362B090B8E32FDE4CD7C02BD065',
    tooltipPath: 'libs/zzz/dm-localization/assets/locales/en/tooltips_gen.json',
    tooltipSha256: 'A9A5443E5E12716DE3F4BF08CB101266A8F2EA61ECCDC563BEF16B98C900E06D',
    statsPath: 'libs/zzz/stats/Data/Characters/Remielle.json',
    statsSha256: 'E09C72F57CDB21349A8C43EDBF3BB944F1CAB475544F8CECC6921537A0474EB3',
  },
  calibration: {
    url: 'https://codecc2.github.io/Remielle-Cal-DMG/',
    status: 'in_game_popup_calibrated_m1_m6',
    boundary:
      'The calculator reports sub-0.01% differences for M1-M6. M0 remains benchmark-limited because Regular Voidflare uses the triggering teammate snapshot.',
  },
  crossValidation: {
    repository: 'https://github.com/vidanj/ZZZ_DMG_OPT',
    commit: '23b024e5d72d2a470233688441a236d8608fa73e',
    license: 'MIT',
    path: 'zzz_dmg_calc/api.py',
    status: 'provisional_benchmark',
  },
  refringeCoefficient: {
    anomalyProficiencyPerPoint: 0.0002,
    threeAnomalyRider: 0.1,
    mindscapeTwoRider: 0.2,
  },
  featheredFate: {
    sourcePath: 'libs/zzz/dm-localization/assets/locales/en/disc_FeatheredFate_gen.json',
    sourceSha256: '5AC034D0D9F7F4CD98C1F9B02C475D148B21250AFA8486F636AB9E43DAD2D784',
    formulaPath: 'libs/zzz/formula/src/data/disc/sheets/FeatheredFate.ts',
    formulaSha256: 'CDAE80241142E2D52FB1A2ECFBCB960B9CDE1E77E9BD34A9D512EB238F493977',
    twoPieceAnomalyProficiency: 30,
    fourPieceAnomalyProficiency: 50,
    lumifluxAnomalyDamageBonus: 0.15,
    durationSeconds: 15,
  },
  luminize: {
    // The localized core table has seven UI levels, not one max-core default.
    anomalyProficiencyPerPointByCoreLevel: [0.001, 0.0012, 0.0014, 0.0015, 0.0016, 0.0018, 0.002],
    mindscapeTwoDefenseIgnoreCondition: 'target_prismatic_or_within_8_seconds_after_expiry',
    mindscapeFourMotionValueMultiplier: 1.12,
    maxVoidflares: 3,
    skills: {
      rainbows_end: { levelBasePercent: 100, levelGrowthPercent: 5 },
      fleeting_grace: { levelBasePercent: 200, levelGrowthPercent: 10 },
      ultimate: { levelBasePercent: 210, levelGrowthPercent: 10.5 },
      flower_feather: { levelBasePercent: 200, levelGrowthPercent: 10 },
    },
  },
  boundary:
    'Benchmark-only source contract. It closes the declared Refringe coefficient and Luminize multiplier arithmetic, not Voidflare creation timing, Phase Flow drain, complete rotations, Formal authority or Import.',
} as const)

export const reviewedLumifluxMechanicsHash32 = stableContentHash(
  reviewedLumifluxMechanicsIdentity32,
)

export type ReviewedLuminizeSkill32 =
  keyof typeof reviewedLumifluxMechanicsIdentity32.luminize.skills

export function evaluateReviewedRefringeCoefficient32(input: {
  anomalyProficiency: number
  anomalyMemberCount: number
  mindscape: number
}) {
  if (
    !Number.isFinite(input.anomalyProficiency) ||
    input.anomalyProficiency < 0 ||
    !Number.isInteger(input.anomalyMemberCount) ||
    input.anomalyMemberCount < 1 ||
    input.anomalyMemberCount > 3 ||
    !Number.isInteger(input.mindscape) ||
    input.mindscape < 0 ||
    input.mindscape > 6
  )
    return { status: 'unsupported' as const, blockers: ['invalid_refringe_domain'] }
  const ap = input.anomalyProficiency * 0.0002
  const threeAnomaly = input.anomalyMemberCount === 3 ? 0.1 : 0
  const mindscapeTwo = input.mindscape >= 2 ? 0.2 : 0
  const coefficient = ap + threeAnomaly + mindscapeTwo
  return {
    status: 'limited_benchmark' as const,
    metric: 'refringe',
    anomalyProficiencyComponent: ap,
    threeAnomalyComponent: threeAnomaly,
    mindscapeTwoComponent: mindscapeTwo,
    coefficient,
    multiplier: 1 + coefficient,
    sourceIdentityHash: reviewedLumifluxMechanicsHash32,
  }
}

export function evaluateReviewedFeatheredFate32(input: {
  equippedPieces: number
  characterAttribute: string
  entersOrActive: boolean
}) {
  if (
    !Number.isInteger(input.equippedPieces) ||
    input.equippedPieces < 0 ||
    input.equippedPieces > 6 ||
    typeof input.entersOrActive !== 'boolean' ||
    typeof input.characterAttribute !== 'string' ||
    !input.characterAttribute.trim()
  )
    return { status: 'unsupported' as const, blockers: ['invalid_feathered_fate_domain'] }
  const twoPiece = input.equippedPieces >= 2
  const fourPieceActive = input.equippedPieces >= 4 && input.entersOrActive
  return {
    status: 'limited_benchmark' as const,
    metric: 'feathered_fate',
    anomalyProficiency:
      (twoPiece
        ? reviewedLumifluxMechanicsIdentity32.featheredFate.twoPieceAnomalyProficiency
        : 0) +
      (fourPieceActive
        ? reviewedLumifluxMechanicsIdentity32.featheredFate.fourPieceAnomalyProficiency
        : 0),
    attributeAnomalyDamageBonus:
      fourPieceActive && input.characterAttribute === 'lumiflux'
        ? reviewedLumifluxMechanicsIdentity32.featheredFate.lumifluxAnomalyDamageBonus
        : 0,
    durationSeconds: fourPieceActive
      ? reviewedLumifluxMechanicsIdentity32.featheredFate.durationSeconds
      : null,
    receiver: 'equipped_character_attribute_anomaly_damage' as const,
    sourceIdentityHash: reviewedLumifluxMechanicsHash32,
  }
}

export function evaluateReviewedLuminizeMultiplier32(input: {
  skill: ReviewedLuminizeSkill32
  effectiveSkillLevel: number
  remielleAnomalyProficiency: number
  remielleMindscape: number
  remielleCoreLevel: number
  /** Explicit current Prismatic / post-expiry window; M2 is not unconditional. */
  prismaticDefenseIgnoreWindow?: boolean
}) {
  if (
    !Number.isInteger(input.effectiveSkillLevel) ||
    input.effectiveSkillLevel < 1 ||
    input.effectiveSkillLevel > 16 ||
    !Number.isFinite(input.remielleAnomalyProficiency) ||
    input.remielleAnomalyProficiency < 0 ||
    !Number.isInteger(input.remielleMindscape) ||
    input.remielleMindscape < 0 ||
    input.remielleMindscape > 6 ||
    !Number.isInteger(input.remielleCoreLevel) ||
    input.remielleCoreLevel < 1 ||
    input.remielleCoreLevel > 7 ||
    (input.remielleMindscape >= 2 && typeof input.prismaticDefenseIgnoreWindow !== 'boolean')
  )
    return { status: 'unsupported' as const, blockers: ['invalid_luminize_domain'] }
  const skill = reviewedLumifluxMechanicsIdentity32.luminize.skills[input.skill]
  if (!skill) return { status: 'unsupported' as const, blockers: ['unknown_luminize_skill'] }
  const basePercent = skill.levelBasePercent + skill.levelGrowthPercent * input.effectiveSkillLevel
  const anomalyProficiencyPerPoint =
    reviewedLumifluxMechanicsIdentity32.luminize.anomalyProficiencyPerPointByCoreLevel[
      input.remielleCoreLevel - 1
    ]!
  const anomalyProficiencyMultiplier =
    1 + anomalyProficiencyPerPoint * input.remielleAnomalyProficiency
  const mindscapeFourMultiplier = input.remielleMindscape >= 4 ? 1.12 : 1
  return {
    status: 'limited_benchmark' as const,
    metric: 'luminize',
    skill: input.skill,
    effectiveSkillLevel: input.effectiveSkillLevel,
    coreLevel: input.remielleCoreLevel,
    anomalyProficiencyPerPoint,
    basePercent,
    anomalyProficiencyMultiplier,
    mindscapeFourMultiplier,
    finalPercent: basePercent * anomalyProficiencyMultiplier * mindscapeFourMultiplier,
    mindscapeOneResistanceIgnore: input.remielleMindscape >= 1 ? 0.5 : 0,
    mindscapeTwoDefenseIgnore:
      input.remielleMindscape >= 2 && input.prismaticDefenseIgnoreWindow === true ? 0.15 : 0,
    sourceIdentityHash: reviewedLumifluxMechanicsHash32,
  }
}
