import formulaCatalog from '../gameDataPacks/generated/current-formula-mechanic-contract-catalog.v1.json'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { effectReceiverMetadata, requiredReferences } from './currentPlanningEffectExpressions'
import { getCurrentFormulaContractRequirements } from './currentFormulaMechanicContracts'
import { applyReviewedPlanningConditionDomains32 } from './reviewedPlanningConditionSemantics32'
import { reviewedPlanningConditionSemanticsIdentity32 } from './reviewedPlanningConditionSemanticsIdentity32'
import { sourceSeeds, type SourceSeed } from './currentPlanningConditionSourceSeeds32'
import { applyReviewedRoxyAttributeWindowDomains32 } from './reviewedRoxyAttributeWindows32'
import { reviewedRoxyAttributeWindowsIdentity32 } from './reviewedRoxyAttributeWindowsIdentity32'
import { appendReviewedDriveDiscConditions32 } from './reviewedDriveDiscConditionDomains32'
import { reviewedDriveDiscSemanticsIdentity32 } from './reviewedDriveDiscSemanticsIdentity32'

export type PlanningConditionDef32 = {
  providerAgentId: string
  referenceKey: string
  label: string
  valueKind: 'boolean' | 'number' | 'enum'
  options?: Array<{ value: string | number | boolean; label: string }>
  minimum?: number
  maximum?: number
  sourceRefs: string[]
}
const repository = 'https://github.com/frzyc/genshin-optimizer'
const commit = '3456cd0f6f5bea10e168074502460dac2fcd6df4'
const mappedSourceLocatorPolicy = 'pinned-bytes-with-repository-or-opaque-locator-v1'
function matchesMappedSourceLocator(path: string, key: string) {
  // Community builds redact private locators. The separately checked pinned
  // byte hash remains authoritative; an opaque locator never approves bytes.
  return (
    path.endsWith(`libs/zzz/stats/src/mappedStats/char/maps/${key}.ts`) ||
    /^soda-source-ref:[0-9a-f]{32}$/u.test(path)
  )
}
export const currentPlanningConditionCatalogIdentity32 = Object.freeze({
  version: 'planning32-source-condition-domains-v6',
  repository,
  commit,
  sourceHash: stableContentHash({
    sourceSeeds,
    semantics: reviewedPlanningConditionSemanticsIdentity32,
    roxyWindows: reviewedRoxyAttributeWindowsIdentity32,
    mappedSourceLocatorPolicy,
    driveDiscs: reviewedDriveDiscSemanticsIdentity32,
  }),
})
export type PlanningConditionCatalogInput32 = {
  subjectAgentId: string
  memberIds: readonly string[]
  equippedWEngines?: readonly { providerAgentId: string; engineId: string }[]
  equippedDriveDiscs?: readonly { providerAgentId: string; setId: string; pieces: number }[]
  sourceIdentity?: Readonly<{
    [K in keyof typeof currentPlanningConditionCatalogIdentity32]: string
  }>
}
export type PlanningConditionEvidence32 = {
  providerAgentId: string
  referenceKey: string
  engineId?: string
  discSetId?: string
  unit: 'boolean_state' | 'integer_stack' | 'source_enum'
  meaning: string
  integerOnly: boolean
  runtimeReference: string
  effectKeys: string[]
  eventScopes: Array<{
    effectKey: string
    applicationScope: string
    damageType: string | null
    eventIds: string[]
    sourceRefs?: string[]
  }>
  sourceRefs: string[]
}
export type PlanningConditionProjection32 = {
  status: 'supported' | 'unsupported'
  defs: PlanningConditionDef32[]
  evidence: PlanningConditionEvidence32[]
  blockedReferences: Array<{
    providerAgentId: string
    referenceKey: string
    reason: string
    sourceRefs: string[]
  }>
  derivedReferences: Array<{
    providerAgentId: string
    referenceKey: string
    engineId?: string
    producer: string
  }>
  blockers: string[]
  sourceIdentity: typeof currentPlanningConditionCatalogIdentity32
}
const projectionInputs = new WeakMap<
  PlanningConditionProjection32,
  PlanningConditionCatalogInput32
>()
const actorIds: Record<string, string> = {
  Claret: 'agent-claret',
  Roxy: 'agent-roxy',
  Koleda: 'agent-koleda',
  Norma: 'agent-norma',
  Rina: 'agent-rina',
}
const labels: Record<string, string> = {
  crimsonInscription: '猩红铭刻',
  perfectDodge: '极限闪避效果',
  remnantEdge: '余锋效果',
  contamination: '污染效果',
  enemyHit: '命中敌人效果',
  exSpecialUsed: '强化特殊技效果',
  kindlyHits: 'Kindly 命中效果',
  chillHits: 'Chill 命中效果',
  furnaceFire: '炉火层数',
  charge: '充能层数',
  exSpecial_debuff: '强化特殊技减益层数',
  quick_use: '快速使用效果',
  windswept: '风蚀状态',
  isStunned: '敌人失衡状态',
  exSpecialMaim: '强化特殊技裂伤效果',
  windExSpecialUsed: '风属性强化特殊技效果',
}
const seedRefs = (seed: SourceSeed) => [
  `${repository}@${commit}`,
  `${seed.formulaPath}#sha256=${seed.formulaHash}`,
  `${seed.metaPath}#sha256=${seed.metaHash}`,
  ...(seed.dataPath ? [`${seed.dataPath}#sha256=${seed.dataHash}`] : []),
]
const producerFor = (ref: string) =>
  /^dm\./.test(ref)
    ? 'locked_mapped_stats'
    : /^(ownBuff|notOwnBuff|teamBuff|enemyDebuff)\./.test(ref)
      ? 'effect_receiver'
      : /^(own|target)\.(initial|final)\./.test(ref)
        ? 'initial_or_event_final_stats'
        : /^(char\.|(own|target)\.char\.)/.test(ref)
          ? 'actual_account_or_identity'
          : /^team\./.test(ref)
            ? 'actual_formation_identity'
            : null

function containsFormulaReference(value: unknown, referenceKey: string): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((x) => containsFormulaReference(x, referenceKey))
  const record = value as Record<string, unknown>
  return (
    record.key === referenceKey ||
    Object.values(record).some((x) => containsFormulaReference(x, referenceKey))
  )
}

/** Metadata only: membership and equipped identity are supplied by the trusted producer. */
export function projectCurrentPlanningConditionCatalog32(
  input: PlanningConditionCatalogInput32,
): PlanningConditionProjection32 {
  const result: PlanningConditionProjection32 = {
    status: 'supported',
    defs: [],
    evidence: [],
    blockedReferences: [],
    derivedReferences: [],
    blockers: [],
    sourceIdentity: currentPlanningConditionCatalogIdentity32,
  }
  if (
    !input.memberIds.includes(input.subjectAgentId) ||
    new Set(input.memberIds).size !== input.memberIds.length ||
    input.memberIds.length < 1 ||
    input.memberIds.length > 3 ||
    input.memberIds.some((id) => !getCurrentAgentEventContract(id))
  )
    result.blockers.push('条件目录要求有效主体与实际不重复队伍成员。')
  if (
    input.sourceIdentity &&
    stableContentHash(input.sourceIdentity) !==
      stableContentHash(currentPlanningConditionCatalogIdentity32)
  )
    result.blockers.push('条件目录锁定来源身份不匹配。')
  const add = (
    seed: SourceSeed,
    providerAgentId: string,
    ref: string,
    effects: PlanningConditionEvidence32['eventScopes'],
    runtimeReference = ref,
  ) => {
    const cond = seed.conditionals[ref]
    const sourceRefs = [
      ...new Set([...seedRefs(seed), ...effects.flatMap((effect) => effect.sourceRefs ?? [])]),
    ]
    if (
      !cond ||
      cond.sheet !== seed.key ||
      cond.name !== ref ||
      !['bool', 'num', 'list'].includes(cond.type) ||
      (cond.type === 'num' && (!Number.isFinite(cond.min) || !Number.isFinite(cond.max))) ||
      (cond.type === 'list' && !cond.list?.length)
    ) {
      result.blockedReferences.push({
        providerAgentId,
        referenceKey: runtimeReference,
        reason: '真实条件定义缺失或类型/domain未闭合；缺声明不得默认为 false。',
        sourceRefs,
      })
      return
    }
    const valueKind = cond.type === 'bool' ? 'boolean' : cond.type === 'num' ? 'number' : 'enum'
    result.defs.push({
      providerAgentId,
      referenceKey: runtimeReference,
      label: labels[ref] ?? ref,
      valueKind,
      ...(valueKind === 'number' ? { minimum: cond.min, maximum: cond.max } : {}),
      ...(valueKind === 'enum'
        ? { options: cond.list!.map((value) => ({ value, label: String(value) })) }
        : {}),
      sourceRefs,
    })
    result.evidence.push({
      providerAgentId,
      referenceKey: runtimeReference,
      ...(seed.engineId ? { engineId: seed.engineId } : {}),
      unit:
        valueKind === 'boolean'
          ? 'boolean_state'
          : valueKind === 'number'
            ? 'integer_stack'
            : 'source_enum',
      meaning: `上游 ${seed.key}.${ref} 条件；激活持续时间和事件状态必须由具名声明提供。`,
      integerOnly: cond.int_only === true,
      runtimeReference,
      effectKeys: effects.map((x) => x.effectKey),
      eventScopes: effects,
      sourceRefs,
    })
  }
  for (const seed of sourceSeeds.filter(
    (x) => x.kind === 'char' && input.memberIds.includes(actorIds[x.key]),
  )) {
    const providerAgentId = actorIds[seed.key]
    const actor = getCurrentAgentEventContract(providerAgentId)
    const effectSource = getCurrentAgentDecisionMechanicContract(providerAgentId)?.effectContract
    if (
      !actor ||
      !effectSource ||
      actor.externalId !== seed.externalId ||
      actor.upstreamKey !== seed.key ||
      actor.source.repository !== repository ||
      actor.source.commit !== commit ||
      effectSource.source.repository !== repository ||
      effectSource.source.commit !== commit ||
      actor.source.formulaPath !== seed.formulaPath ||
      effectSource.source.formulaPath !== seed.formulaPath ||
      actor.source.formulaSha256 !== seed.formulaHash ||
      effectSource.source.formulaSha256 !== seed.formulaHash ||
      actor.source.statsSha256 !== seed.dataHash ||
      actor.source.statsPath !== seed.dataPath ||
      effectSource.runtimeDefaults.source.mappedStatsSha256 !== seed.mappedHash ||
      !matchesMappedSourceLocator(effectSource.runtimeDefaults.source.mappedStatsPath, seed.key)
    ) {
      result.blockers.push(`条件目录双来源指纹不匹配：${providerAgentId}`)
      continue
    }
    const requirements = new Map<string, PlanningConditionEvidence32['eventScopes']>()
    for (const blueprint of currentAgentPlanningEffectBlueprints.filter(
      (x) => x.providerAgentId === providerAgentId,
    )) {
      const damageType = effectReceiverMetadata(blueprint.numericExpression.expressionIr).damageType
      const scope = {
        effectKey: blueprint.effectKey,
        applicationScope: blueprint.applicationScope ?? 'generic',
        damageType,
        sourceRefs: blueprint.sourceRefs,
        eventIds: actor.eventContract.events
          .filter(
            (event) =>
              event.eventModifierRefs.includes(blueprint.effectKey) ||
              event.eventModifierRefs.includes(blueprint.effectId),
          )
          .map((event) => event.eventId),
      }
      for (const ref of requiredReferences(blueprint.numericExpression.expressionIr)) {
        const producer = producerFor(ref)
        if (producer) {
          if (
            !result.derivedReferences.some(
              (x) => x.providerAgentId === providerAgentId && x.referenceKey === ref,
            )
          )
            result.derivedReferences.push({ providerAgentId, referenceKey: ref, producer })
          continue
        }
        requirements.set(ref, [...(requirements.get(ref) ?? []), scope])
      }
    }
    for (const [ref, scopes] of requirements) {
      const ownerSeed = seed.conditionals[ref]
        ? seed
        : sourceSeeds.find((x) => x.kind === 'common' && x.conditionals[ref])
      if (seed.key === 'Norma')
        result.blockedReferences.push({
          providerAgentId,
          referenceKey: ref,
          reason:
            '锁定Norma公式仍是TODO占位条件；真实meta类型/domain已保留于来源提取，不开放生产声明。',
          sourceRefs: seedRefs(seed),
        })
      else if (ownerSeed) add(ownerSeed, providerAgentId, ref, scopes)
      else
        result.blockedReferences.push({
          providerAgentId,
          referenceKey: ref,
          reason: 'requiredReferences 尚无锁定条件定义或可信生产者。',
          sourceRefs: seedRefs(seed),
        })
    }
  }
  const equipped = input.equippedWEngines ?? []
  if (new Set(equipped.map((x) => x.providerAgentId)).size !== equipped.length)
    result.blockers.push('同一主体音擎装备声明重复。')
  for (const binding of equipped) {
    const seed = sourceSeeds.find((x) => x.engineId === binding.engineId)
    const actor = getCurrentAgentEventContract(binding.providerAgentId)
    const source = getCurrentWEngineStaticData(binding.engineId)
    const contract = formulaCatalog.wengineItems.find((x) => x.stableId === binding.engineId)
    if (!input.memberIds.includes(binding.providerAgentId) || !actor) {
      result.blockers.push(`音擎条件 owner 不在实际队伍：${binding.providerAgentId}`)
      continue
    }
    if (!seed) {
      result.blockers.push(`音擎不在3.2限定条件来源范围：${binding.engineId}`)
      continue
    }
    const specialty = actor.identity.specialty === 'attack' ? 'damage' : actor.identity.specialty
    if (specialty !== seed.specialty) {
      result.blockers.push(`音擎条件装备特性不匹配：${binding.providerAgentId}:${binding.engineId}`)
      continue
    }
    if (
      !source ||
      !contract ||
      formulaCatalog.generatedFrom.repository !== repository ||
      formulaCatalog.generatedFrom.commit !== commit ||
      source.upstreamKey !== seed.key ||
      source.specialty !== seed.specialty ||
      contract.upstreamKey !== seed.key ||
      source.source.formulaPath !== seed.formulaPath ||
      contract.source.formulaPath !== seed.formulaPath ||
      source.source.formulaSha256 !== seed.formulaHash ||
      contract.source.formulaSha256 !== seed.formulaHash ||
      source.source.dataSha256 !== seed.dataHash ||
      contract.source.dataSha256 !== seed.dataHash ||
      source.source.dataPath !== seed.dataPath ||
      contract.source.dataPath !== seed.dataPath
    ) {
      result.blockers.push(`音擎条件双来源指纹不匹配：${binding.engineId}`)
      continue
    }
    const reqs = getCurrentFormulaContractRequirements('wengine', binding.engineId)
    for (const ref of [
      ...(reqs?.flags ?? []),
      ...(reqs?.numbers ?? []),
      ...(reqs?.accumulators ?? []),
    ]) {
      if (ref.startsWith(`${seed.key}:`))
        add(
          seed,
          binding.providerAgentId,
          ref.slice(seed.key.length + 1),
          contract.effects.flatMap((effect, index) => {
            if (!containsFormulaReference(effect, ref)) return []
            const damageType = (effect as { action?: string }).action ?? null
            return [
              {
                effectKey: `wengine:${binding.engineId}:formula:${index}`,
                applicationScope: 'formula_contract',
                damageType,
                eventIds: damageType
                  ? actor.eventContract.events
                      .filter((event) => event.damageType === damageType)
                      .map((event) => event.eventId)
                  : [],
              },
            ]
          }),
          ref,
        )
      else if (
        ref === `wengine:${seed.key}:specialty_and_equipped` ||
        producerFor(ref) ||
        /^(eq|ne):(own|target)\.char\./.test(ref)
      )
        result.derivedReferences.push({
          providerAgentId: binding.providerAgentId,
          referenceKey: ref,
          engineId: binding.engineId,
          producer: ref.startsWith('wengine:')
            ? 'actual_equipped_specialty'
            : (producerFor(ref) ?? 'actual_formation_identity'),
        })
      else
        result.blockedReferences.push({
          providerAgentId: binding.providerAgentId,
          referenceKey: ref,
          reason: '音擎 requiredReferences 缺少真实条件 domain 或可信生产者。',
          sourceRefs: seedRefs(seed),
        })
    }
  }
  if (!result.blockers.length) applyReviewedPlanningConditionDomains32(result)
  if (!result.blockers.length) applyReviewedRoxyAttributeWindowDomains32(result)
  if (!result.blockers.length) appendReviewedDriveDiscConditions32(result, input)
  if (result.blockers.length) {
    result.status = 'unsupported'
    result.defs = []
    result.evidence = []
  }
  projectionInputs.set(result, structuredClone(input))
  return result
}

/** Rebuild against current locked sources; caller supplied defs never establish trust. */
export function resolveCurrentPlanningConditionDeclarations32(input: {
  projection: PlanningConditionProjection32
  declarations: readonly { providerAgentId: string; referenceKey: string; value: unknown }[]
}) {
  const trustedInput = projectionInputs.get(input.projection)
  if (!trustedInput)
    return {
      status: 'unsupported' as const,
      blockers: ['条件目录并非由可信生产者投影。'],
      values: [],
    }
  const current = projectCurrentPlanningConditionCatalog32(trustedInput)
  const blockers = [...current.blockers]
  const declarations = new Map<string, unknown>()
  for (const entry of input.declarations) {
    const key = `${entry.providerAgentId}:${entry.referenceKey}`
    const def = current.defs.find(
      (x) => x.providerAgentId === entry.providerAgentId && x.referenceKey === entry.referenceKey,
    )
    const evidence = current.evidence.find(
      (x) => x.providerAgentId === entry.providerAgentId && x.referenceKey === entry.referenceKey,
    )
    if (declarations.has(key)) blockers.push(`条件声明重复：${key}`)
    if (!def || !evidence) {
      blockers.push(`条件声明没有实际来源/owner/装备绑定：${key}`)
      continue
    }
    if (
      def.valueKind === 'boolean'
        ? typeof entry.value !== 'boolean'
        : def.valueKind === 'number'
          ? typeof entry.value !== 'number' ||
            !Number.isFinite(entry.value) ||
            entry.value < def.minimum! ||
            entry.value > def.maximum! ||
            (evidence.integerOnly && !Number.isInteger(entry.value))
          : !def.options?.some((x) => x.value === entry.value)
    ) {
      blockers.push(`条件声明超出真实 domain：${key}`)
      continue
    }
    declarations.set(key, entry.value)
  }
  const values = current.defs.map((def) => {
    const key = `${def.providerAgentId}:${def.referenceKey}`
    const declared = declarations.has(key)
    const value = declarations.get(key)
    return {
      providerAgentId: def.providerAgentId,
      referenceKey: def.referenceKey,
      disposition: !declared
        ? ('unknown' as const)
        : value === false
          ? ('declared_off' as const)
          : value === true
            ? ('declared_on' as const)
            : ('declared_value' as const),
      ...(declared ? { value } : {}),
    }
  })
  return {
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    blockers,
    values,
  }
}
