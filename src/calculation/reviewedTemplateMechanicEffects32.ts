import { canonicalJson, sha256 } from '../application/contentHash'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { UpstreamExpressionIR } from './currentUpstreamExpressionIR'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { requiredReferences } from './currentPlanningEffectExpressions'

/** Hand-compiled components from the pinned skill text. These replace none of
 * the raw actions and do not assert complete mechanics, uptime or team DPS. */
export const reviewedTemplateMechanicSource32 = Object.freeze({
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  localizationHashes: {
    Sigrid: '7AB24D9F98286C3669456F2A7D5314C40BF2A95544BE29EC351B1E164CB195A4',
    Sunna: '494AFF0E833A8210A688831A384501380D58DFBF4452861EDFE15060AFE305C6',
    NangongYu: 'CE26FC80D874F70E5F9B1FEAA103A401771739D9208F32E8561F393DD34DD923',
    YeShunguang: '5E7A42606A766999FB643E1FDDA3F3353E8AEEF5A7B91D421BC362A5282FE834',
    Cissia: '85D236F69F5DDCAF25998A07EAF58C5BE7EE5D2DD4CF9EA7D4BCAA476EC51484',
    Pyrois: '556162332D01DD475341E1CF42C4E761EE8697C6B891413481BD816C121EC120',
    Norma: 'E07687D9D04CC6BC9DF9ADF87654AAF9020F58E5F70541FDAD041F53366F3065',
    Zhao: 'F596684A31ADBB4AC0F9C1DA61CF81B69C11A9872897FED5C7D067562F2CAE94',
    Remielle: '7C54868CE6D99A369342BBB286D7E4D8E16F4246F25CA7A63A4876974969CE4F',
    Lucia: '839156636939C7689DA364C0B306E1B644D173C4F4EA33E4F3C60553ABFCBDF4',
    Aria: '19C145475722980973D75C24ED3F100B35CB79AA4BA368F22E20C41F09B20433',
    Promeia: 'E3F81E403A01D9839EE65FE8B023D035E882965C7905A210BC369F9E8E246033',
    Velina: 'A70B14513BE88DF531316DC95026676483A41AD95810C4B88050656F8BB63C9F',
  },
})

const lit = (value: unknown): UpstreamExpressionIR => ({ kind: 'literal', value })
const ref = (path: string): UpstreamExpressionIR => ({ kind: 'reference', path })
const call = (operator: string, ...arguments_: UpstreamExpressionIR[]): UpstreamExpressionIR => ({
  kind: 'call',
  operator,
  arguments: arguments_,
})
const core = (values: number[]) =>
  call('subscript', ref('char.core'), { kind: 'array', items: values.map(lit) })
const active = (name: string, value: UpstreamExpressionIR) =>
  call('cmpEq', ref(name), lit(true), value, lit(0))
const ability = (value: UpstreamExpressionIR) => call('abilityCheck', value)
const excess = (path: string, origin: number) =>
  call('max', lit(0), call('sum', ref(path), lit(-origin)))

function component(input: {
  key: keyof typeof reviewedTemplateMechanicSource32.localizationHashes
  agentId: string
  effectId: string
  receiver: string
  value: UpstreamExpressionIR
  locators: string[]
  target: 'self' | 'team' | 'enemy'
  damageType?: string
}): CurrentAgentPlanningEffectBlueprint {
  const path = `libs/zzz/dm-localization/assets/locales/en/char_${input.key}_gen.json`
  const expression: UpstreamExpressionIR = {
    kind: 'call',
    operator: input.damageType ? 'addWithDmgType' : 'add',
    receiver: ref(input.receiver),
    arguments: input.damageType ? [lit(input.damageType), input.value] : [input.value],
  }
  const operators = new Set<string>()
  const visit = (node: UpstreamExpressionIR): void => {
    if (node.kind === 'call') {
      operators.add(node.operator)
      if (node.receiver) visit(node.receiver)
      node.arguments.forEach(visit)
    } else if (node.kind === 'array') node.items.forEach(visit)
    else if (node.kind === 'object') node.entries.forEach((entry) => visit(entry.value))
    else if (node.kind === 'property') visit(node.receiver)
    else if (node.kind === 'element') {
      visit(node.receiver)
      visit(node.index)
    }
  }
  visit(expression)
  return {
    effectKey: `${input.agentId}:${input.effectId}`,
    providerAgentId: input.agentId,
    effectId: input.effectId,
    targetKinds: [input.target],
    snapshotPolicy: 'recompute_per_event',
    activationBoundary: 'explicit_planning_baseline_disposition_required',
    numericExpression: {
      sourceStatus: 'declarative_baseline_input',
      operators: [...operators].sort(),
      dependencyKinds: ['source_text_compiled_component'],
      expressionSha256: sha256(canonicalJson(expression)),
      expressionIr: expression,
      expressionIrReady: true,
      todoBoundary: null,
    },
    sourceRefs: [
      `https://github.com/frzyc/genshin-optimizer@${reviewedTemplateMechanicSource32.commit}`,
      `${path}#sha256=${reviewedTemplateMechanicSource32.localizationHashes[input.key]}`,
      ...input.locators.map((locator) => `${path}#${locator}`),
      'reviewed-template-component32:partial-mechanism-no-uptime-or-dps',
    ],
  }
}

export const reviewedTemplateMechanicEffectBlueprints32: readonly CurrentAgentPlanningEffectBlueprint[] =
  Object.freeze([
    component({
      key: 'Aria',
      agentId: 'agent-aria',
      effectId: 'reviewed_core_proficiency32',
      target: 'self',
      receiver: 'ownBuff.combat.anomProf',
      value: core([45, 52, 60, 67, 75, 82, 90]),
      locators: ['/core/desc/0..6/0'],
    }),
    component({
      key: 'Promeia',
      agentId: 'agent-promeia',
      effectId: 'reviewed_initial_mastery_proficiency32',
      target: 'self',
      receiver: 'ownBuff.combat.anomProf',
      value: call('prod', excess('own.initial.anomMas', 150), lit(1.5)),
      locators: ['/core/desc/0..6/0'],
    }),
    component({
      key: 'Velina',
      agentId: 'agent-velina',
      effectId: 'reviewed_initial_regen_damage32',
      target: 'self',
      receiver: 'ownBuff.combat.common_dmg_',
      value: call('min', lit(0.35), call('prod', excess('own.initial.enerRegen', 1.2), lit(0.21))),
      locators: ['/core/desc/0..6/0'],
    }),
    component({
      key: 'Velina',
      agentId: 'agent-velina',
      effectId: 'reviewed_initial_regen_mastery32',
      target: 'self',
      receiver: 'ownBuff.combat.anomMas',
      value: call('min', lit(84), call('prod', excess('own.initial.enerRegen', 1.2), lit(50))),
      locators: ['/core/desc/0..6/0'],
    }),
    component({
      key: 'Sigrid',
      agentId: 'agent-sigrid',
      effectId: 'reviewed_aerial_patrol_crit32',
      target: 'self',
      receiver: 'ownBuff.combat.crit_',
      value: active(
        'sigridAerialPatrolCritWindow32',
        core([0.33, 0.39, 0.44, 0.5, 0.55, 0.61, 0.66]),
      ),
      locators: ['/core/desc/0..6/5'],
    }),
    component({
      key: 'Sunna',
      agentId: 'agent-sunna',
      effectId: 'reviewed_angelic_chord_attack32',
      target: 'team',
      receiver: 'teamBuff.combat.atk',
      value: active(
        'sunnaAngelicChordination32',
        call(
          'min',
          call('prod', ref('own.initial.atk'), lit(0.3)),
          core([525, 615, 705, 795, 885, 975, 1050]),
        ),
      ),
      locators: ['/core/desc/0..6/0', '/special/EXSpecialAttackBubblegumBarrage/desc/2'],
    }),
    component({
      key: 'Sunna',
      agentId: 'agent-sunna',
      effectId: 'reviewed_delusion_stun32',
      target: 'enemy',
      receiver: 'enemyDebuff.common.stun_',
      value: ability(active('sunnaDelusionStunWindow32', lit(0.3))),
      locators: ['/ability/desc/0', '/ability/desc/1'],
    }),
    component({
      key: 'NangongYu',
      agentId: 'agent-nangong',
      effectId: 'reviewed_initial_mastery_impact32',
      target: 'self',
      receiver: 'ownBuff.combat.impact',
      value: excess('own.initial.anomMas', 110),
      locators: ['/core/desc/0..6/1'],
    }),
    component({
      key: 'NangongYu',
      agentId: 'agent-nangong',
      effectId: 'reviewed_core_team_damage32',
      target: 'team',
      receiver: 'teamBuff.combat.common_dmg_',
      value: active('nangongCoreHitWindow32', core([0.13, 0.15, 0.17, 0.19, 0.21, 0.23, 0.25])),
      locators: ['/core/desc/0..6/6'],
    }),
    component({
      key: 'NangongYu',
      agentId: 'agent-nangong',
      effectId: 'reviewed_misstep_stun32',
      target: 'enemy',
      receiver: 'enemyDebuff.common.stun_',
      value: ability(active('nangongMisstep32', lit(0.3))),
      locators: ['/ability/desc/0', '/ability/desc/5'],
    }),
    component({
      key: 'Cissia',
      agentId: 'agent-cissia',
      effectId: 'reviewed_venom_team_crit_damage32',
      target: 'team',
      receiver: 'teamBuff.combat.crit_dmg_',
      value: ability(active('cissiaVenomBuffWindow32', lit(0.4))),
      locators: ['/ability/desc/0', '/ability/desc/1'],
    }),
    component({
      key: 'Cissia',
      agentId: 'agent-cissia',
      effectId: 'reviewed_venom_self_crit_damage32',
      target: 'self',
      receiver: 'ownBuff.combat.crit_dmg_',
      value: ability(active('cissiaVenomBuffWindow32', lit(0.1))),
      locators: ['/ability/desc/0', '/ability/desc/1'],
    }),
    component({
      key: 'YeShunguang',
      agentId: 'agent-ye-shunguang',
      effectId: 'reviewed_unity_crit32',
      target: 'self',
      receiver: 'ownBuff.combat.crit_',
      value: active('yeShunguangUnity32', core([0.15, 0.175, 0.2, 0.225, 0.25, 0.275, 0.3])),
      locators: ['/core/desc/0..6/1'],
    }),
    component({
      key: 'YeShunguang',
      agentId: 'agent-ye-shunguang',
      effectId: 'reviewed_unity_damage32',
      target: 'self',
      receiver: 'ownBuff.combat.common_dmg_',
      value: active('yeShunguangUnity32', core([0.1, 0.125, 0.15, 0.175, 0.2, 0.225, 0.25])),
      locators: ['/core/desc/0..6/1'],
    }),
    component({
      key: 'Pyrois',
      agentId: 'agent-pyrois',
      effectId: 'reviewed_sunflare_damage32',
      target: 'self',
      receiver: 'ownBuff.combat.common_dmg_',
      value: active('pyroisSunflare32', core([0.2, 0.234, 0.268, 0.302, 0.336, 0.37, 0.4])),
      locators: ['/core/desc/0..6/3'],
    }),
    component({
      key: 'Pyrois',
      agentId: 'agent-pyrois',
      effectId: 'reviewed_ability_crit_damage32',
      target: 'self',
      receiver: 'ownBuff.combat.crit_dmg_',
      value: ability(lit(0.4)),
      locators: ['/ability/desc/0', '/ability/desc/1'],
    }),
    component({
      key: 'Norma',
      agentId: 'agent-norma',
      effectId: 'reviewed_initial_crit_conversion32',
      target: 'self',
      receiver: 'ownBuff.combat.crit_dmg_',
      value: call(
        'min',
        call(
          'prod',
          excess('own.initial.crit_', 0.5),
          core([0.86, 1, 1.14, 1.28, 1.42, 1.56, 1.7]),
        ),
        core([0.43, 0.5, 0.57, 0.64, 0.71, 0.78, 0.85]),
      ),
      locators: ['/core/desc/0..6/0'],
    }),
    component({
      key: 'Norma',
      agentId: 'agent-norma',
      effectId: 'reviewed_sheer_force_attack32',
      target: 'self',
      receiver: 'ownBuff.combat.atk',
      value: call('min', lit(1200), call('prod', ref('own.final.sheerForce'), lit(1.25))),
      locators: ['/core/desc/0..6/2'],
    }),
    component({
      key: 'Norma',
      agentId: 'agent-norma',
      effectId: 'reviewed_en_nah_team_damage32',
      target: 'team',
      receiver: 'teamBuff.combat.common_dmg_',
      value: ability(active('normaEnNahBarrage32', lit(0.2))),
      locators: ['/ability/desc/0', '/ability/desc/4'],
    }),
    component({
      key: 'Zhao',
      agentId: 'agent-zhao',
      effectId: 'reviewed_wellspring_attack32',
      target: 'team',
      receiver: 'teamBuff.combat.atk',
      value: active('zhaoWellspringAttackWindow32', core([100, 250, 400, 550, 700, 850, 1000])),
      locators: ['/core/desc/0..6/6'],
    }),
    component({
      key: 'Remielle',
      agentId: 'agent-remielle',
      effectId: 'reviewed_phase_flow_daze32',
      target: 'self',
      receiver: 'ownBuff.combat.dazeInc_',
      value: ability(
        active(
          'remiellePhaseFlow32',
          call('subscript', call('withSpecialty', lit('anomaly')), {
            kind: 'array',
            items: [0, 0.06, 0.12, 0.35].map(lit),
          }),
        ),
      ),
      locators: ['/ability/desc/0', '/ability/desc/1'],
    }),
  ])

/** The reviewed blueprints are a separate local source, not fabricated upstream AST. */
export function isReviewedTemplateMechanicEffect32(entry: CurrentAgentPlanningEffectBlueprint) {
  const expected = reviewedTemplateMechanicEffectBlueprints32.find(
    (row) => row.effectKey === entry.effectKey,
  )
  return Boolean(
    expected &&
    entry.providerAgentId === expected.providerAgentId &&
    entry.numericExpression.expressionSha256 === expected.numericExpression.expressionSha256 &&
    canonicalJson(entry) === canonicalJson(expected),
  )
}

/** Values are event observations of these exact source windows, never inferred
 * from an equipped build, elapsed rotation or one generic character flag. */
export function validateReviewedTemplateMechanicObservations32(input: {
  entry: CurrentAgentPlanningEffectBlueprint
  references?: Readonly<Record<string, unknown>>
}) {
  if (!isReviewedTemplateMechanicEffect32(input.entry)) return { status: 'supported' as const }
  const stateReferences = requiredReferences(input.entry.numericExpression.expressionIr).filter(
    (name) => name.endsWith('32') && !name.includes('.'),
  )
  const invalid = stateReferences.filter(
    (name) =>
      Object.hasOwn(input.references ?? {}, name) && typeof input.references?.[name] !== 'boolean',
  )
  return invalid.length
    ? {
        status: 'unsupported' as const,
        blockers: [`已核组件事件状态必须为明确布尔观测：${invalid.join(', ')}`],
      }
    : { status: 'supported' as const }
}

/** Existing Lucia AST is flat base damage, not a percentage damage bonus. The
 * event catalog's modifier refs bind the final hit; an explicit false returns
 * zero and omission remains unknown. No duplicate Harmony blueprint is added. */
export function bindReviewedLuciaHarmonyFinalHit32(input: {
  entry: CurrentAgentPlanningEffectBlueprint
  ownerAgentId: string
  event: { eventId: string; actionId: string; skill: string; eventModifierRefs?: readonly string[] }
  references?: Readonly<Record<string, unknown>>
}) {
  if (input.entry.effectKey !== 'agent-lucia:exSpecial_harmony_dmg_')
    return {
      status: 'supported' as const,
      active: false,
      overrides: {} as Record<string, unknown>,
      valueOverride: undefined as number | undefined,
      sourceRefs: [] as string[],
    }
  const contract = getCurrentAgentEventContract('agent-lucia')
  const expression = getCurrentAgentDecisionMechanicContract(
    'agent-lucia',
  )?.effectContract.effects.find(
    (row) => row.effectId === 'exSpecial_harmony_dmg_',
  )?.numericExpression
  if (
    contract?.source.commit !== reviewedTemplateMechanicSource32.commit ||
    expression?.expressionSha256 !== input.entry.numericExpression.expressionSha256 ||
    canonicalJson(expression.expressionIr) !==
      canonicalJson(input.entry.numericExpression.expressionIr)
  )
    return { status: 'unsupported' as const, blockers: ['卢西娅Harmony来源表达式或版本漂移。'] }
  const event = contract?.eventContract.events.find((row) => row.eventId === input.event.eventId)
  const eligible =
    input.ownerAgentId === 'agent-lucia' &&
    event?.actionId === input.event.actionId &&
    event.skill === input.event.skill &&
    event.eventModifierRefs.includes('exSpecial_harmony_dmg_') &&
    input.event.eventModifierRefs?.includes('exSpecial_harmony_dmg_') === true
  const observed = input.references?.luciaHarmonyFinalHit32
  const sourceRefs = [
    `libs/zzz/dm-localization/assets/locales/en/char_Lucia_gen.json#sha256=${reviewedTemplateMechanicSource32.localizationHashes.Lucia}`,
    'libs/zzz/dm-localization/assets/locales/en/char_Lucia_gen.json#/special/EXSpecialAttackSymphonyOfTheReaperDaybreak/desc/3',
  ]
  if (!eligible)
    return {
      status: 'supported' as const,
      active: true,
      overrides: {},
      valueOverride: 0,
      sourceRefs,
    }
  if (typeof observed !== 'boolean')
    return {
      status: 'unsupported' as const,
      blockers: ['卢西娅Harmony终击缺少明确事件状态：luciaHarmonyFinalHit32'],
    }
  return {
    status: 'supported' as const,
    active: true,
    overrides: {},
    ...(observed ? {} : { valueOverride: 0 }),
    sourceRefs,
  }
}
