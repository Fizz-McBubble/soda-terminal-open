import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import { reviewedTargetPanelGuidance } from '../gameDataPacks/reviewedTargetPanelGuidance'
import { getCurrentBuildTargetPanel } from '../gameDataPacks/currentBuildAuthority'
import { reviewedContextualMechanicTargets } from '../gameDataPacks/reviewedContextualTargetPanel'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'
import { resolveReviewedZhaoHpTarget } from '../gameDataPacks/reviewedZhaoSupportTarget'
import { evaluateCurrentAgentTeamActivation } from '../calculation/currentAgentMechanicContracts'
import type {
  TargetPanelMetricKey,
  TargetPanelSemantics,
} from '../gameDataPacks/targetPanelSemantics'

type Rule =
  | 'note'
  | 'summit'
  | 'ap-engine'
  | 'skill'
  | 'crit-context'
  | 'rina'
  | 'astra'
  | 'ye-crit-context'
// Exact reviewed source notes, not keyword-based permission to ignore a condition.
const rules: Readonly<Record<string, Rule>> = {
  'Anomaly Mastery is 60 higher in combat with signature W-Engine.': 'note',
  'Crit Rate 50% is needed for King of the Summit.': 'summit',
  'Crit Rate 50 is needed for King of the Summit.': 'summit',
  'Crit Rate 50 is for King of the Summit.': 'summit',
  'Crit Rate 50% applies if using 4-piece King of the Summit.': 'summit',
  'Crit Rate 50 is for King of the Summit; ATK gains more in combat.': 'summit',
  'ATK 3430 is required for the maximum Core Skill team buff; Energy Regen range depends on secondary Disk Drive, main stat, and W-Engine.':
    'astra',
  'Crit Rate is in combat including Disk Drive and signature W-Engine.': 'note',
  'ATK range depends on W-Engine and Disk Drive main stat.': 'note',
  'Impact is most important. Choose one optional anomaly or crit route; optional values are not universal requirements.':
    'note',
  'Crit Rate range is with signature W-Engine.': 'crit-context',
  "Crit Rate includes Core passive; 55% external Crit Rate is needed after Core's 25% to enable the ability.":
    'crit-context',
  'Crit Rate is explicitly capped at 75; this upper-only constraint is preserved outside the lower-bound panel.':
    'note',
  'Anomaly Proficiency is in combat; 420 reaches the 600 flat combat ATK cap from Passion.': 'note',
  'HP 24000 is the guide focus within its stated range.': 'note',
  'ATK is a Special-level variant, so no unconditional ATK target is synthesized.': 'skill',
  'Crit Rate is 90-100 in combat; Crit DMG is before combat.': 'note',
  'ATK range depends on Disk Drive main stat.': 'note',
  'ATK and Anomaly Proficiency are explicitly optional.': 'note',
  'Crit Rate includes Orphie passive and Disk Drive passive.': 'crit-context',
  'Only ATK 3000 is required; damage Crit extras are not needed.': 'note',
  'Add 90 Anomaly Proficiency if using an AP main-stat W-Engine.': 'ap-engine',
  'Impact is most important. Choose one optional anomaly or crit route.': 'note',
  'Crit Rate is before Sol Exuvia and M1.': 'note',
  'Going above ATK 4000 does not add meaningful damage. AP range depends on AP Disk 4 and 2-piece choices.':
    'note',
  'PEN Ratio 72 grants the full 30 team buff at Core Passive 6.': 'rina',
  'Shield caps at 3750 Initial ATK but this is hard to achieve.': 'note',
  'Crit Rate is before Additional Ability and Shadow Harmony; Crit DMG is before Core passive.':
    'note',
  'ATK is a Core Passive variant, so no unconditional ATK target is synthesized.': 'skill',
  'Guide marks all other stats not relevant.': 'note',
  'Impact is most important; ability caps Crit Rate at 90 with signature W-Engine.': 'crit-context',
  'Anomaly Proficiency is before combat.': 'note',
  'ATK range depends on W-Engine.': 'note',
  'Crit Rate is maximum 50% in the stat screen; upper-only constraint is preserved outside the lower-bound panel.':
    'ye-crit-context',
  'Pre-combat; assumes 4-piece Yunkui 12% Crit Rate and P1 Kraken 20% Crit Rate. Combat Crit Rate is 90.6-97.2.':
    'crit-context',
  'Crit Rate includes Disk Drive.': 'crit-context',
  'Prioritize ATK under 3000 then AP; Crit path differs for physical versus non-physical teams.':
    'note',
  'Crit Rate is 90-100 with Additional Ability; maximum 55 with Nicole M6. Crit DMG is without Chaotic Metal.':
    'crit-context',
}

export function resolveSavedGraduationTarget(input: {
  memberIds?: readonly string[]
  agent: RosterAgent
  engineId: string
  engineRefinement?: number
  discs: readonly DriveDisc[]
  target: { value: unknown; conditions: readonly string[]; sourceRefs?: readonly { id: string }[] }
}) {
  const frozenGuide = reviewedTargetPanelGuidance(input.agent.agentId)
  const context = {
    coreLevel: input.agent.skillLevels.core,
    specialLevel: input.agent.skillLevels.special,
    engineId: input.engineId,
    engineRefinement: input.engineRefinement ?? input.agent.wEngineDetails?.refinement,
    mindscape: input.agent.mindscape,
  }
  const adopted = getCurrentBuildTargetPanel(input.agent.agentId)
  const contextual = getCurrentBuildTargetPanel(input.agent.agentId, context)
  const mechanic = reviewedContextualMechanicTargets({ ...context, agentId: input.agent.agentId })
  const reviewed = [contextual, adopted, frozenGuide].find(
    (field) =>
      field &&
      JSON.stringify(input.target.value) === JSON.stringify(field.value) &&
      JSON.stringify(input.target.conditions) === JSON.stringify(field.conditions ?? []),
  )
  const source = input.target.value as {
    sourceMetadata?: { sourceId?: string; sourceConditions?: string[] }
    sourceVariants?: string[]
    targetSemantics?: TargetPanelSemantics
    extraStats?: Record<string, unknown>
  } | null
  if (
    mechanic &&
    reviewed &&
    [
      'agent-lucy',
      'agent-soukaku',
      'agent-roxy',
      'agent-astra',
      'agent-rina',
      'agent-sigrid',
      'agent-pan-yinhu',
      'agent-yuzuha',
    ].includes(input.agent.agentId)
  ) {
    return {
      value: contextual!.value as Record<string, unknown>,
      limitations: [...mechanic.conditions],
      applied: ['按当前有效技能与音擎配置核对初始属性机制准备线；不证明战斗增益常驻'],
    }
  }
  const expected = reviewed?.value as typeof source
  // An overridden or newer authority must be reviewed independently.
  if (
    !source?.sourceMetadata?.sourceId ||
    source.sourceMetadata.sourceId !== expected?.sourceMetadata?.sourceId ||
    JSON.stringify(input.target.value) !== JSON.stringify(reviewed?.value) ||
    JSON.stringify(input.target.conditions) !== JSON.stringify(reviewed?.conditions ?? [])
  )
    return null
  const notes = source.sourceMetadata.sourceConditions ?? []
  const sourceRules = notes
    .filter((note) => !note.endsWith(' is explicitly optional in the source.'))
    .map((note) => rules[note])
  if (sourceRules.some((rule) => !rule)) return null

  const value: Record<string, unknown> = { ...(input.target.value as Record<string, unknown>) }
  const semantics: TargetPanelSemantics = { ...source.targetSemantics }
  value.targetSemantics = semantics
  const limitations: string[] = []
  const applied: string[] = []
  const hpTarget = resolveReviewedZhaoHpTarget({
    agentId: input.agent.agentId,
    coreLevel: input.agent.skillLevels.core,
  })
  if (hpTarget) {
    value.hp = { min: hpTarget.minimum }
    const activation = input.memberIds
      ? evaluateCurrentAgentTeamActivation({
          stableId: input.agent.agentId,
          memberIds: input.memberIds,
          agentState: {
            mindscape: input.agent.mindscape,
            potentialImage: input.agent.potentialImage,
          },
        })
      : null
    if (activation?.status === 'supported' && activation.active) {
      applied.push(`独立机制目标：初始生命${hpTarget.minimum}`)
    } else {
      if (semantics.hp) semantics.hp = { ...semantics.hp, requirement: 'optional' }
      limitations.push('追加能力队伍条件未闭合，机制生命目标未计入完成度。')
    }
    limitations.push(...hpTarget.conditions)
    limitations.push('完成度仅核对初始生命准备，不证明队伍增益已经激活。')
  }
  function exclude(key: TargetPanelMetricKey, reason: string) {
    const semantic = semantics[key]
    if (semantic) semantics[key] = { ...semantic, requirement: 'optional' }
    limitations.push(reason)
  }
  for (const [key, semantic] of Object.entries(semantics)) {
    if (semantic.observation === 'in_combat' && semantic.requirement === 'required')
      limitations.push(
        `${key === 'critRate' ? '暴击率' : '异常精通'}为战斗内目标，未计入局外完成度`,
      )
  }
  if (source.extraStats?.sheerForce) limitations.push('贯穿力目标尚未计入')
  if (source.extraStats?.energyRegenPercent) limitations.push('能量回复百分比目标尚未计入')
  for (const rule of sourceRules) {
    if (rule === 'ye-crit-context') {
      // This is an optimization reference under combat buffs, not a universal
      // stat-screen cap. Saved equipment cannot prove their active window.
      exclude('critRate', '暴击率50%为满核心与沧浪行歌四件套增益生效时的参考，未作为通用毕业限制')
      applied.push('保留暴击率配装参考，按攻击力与暴击伤害目标计算完成度')
    }
    if (rule === 'astra' && !mechanic)
      exclude('atk', '请录入实际核心与影画等级，以核对相应攻击准备线；攻略方向仍保留')
    if (rule === 'summit') {
      const active =
        input.discs.filter((disc) => disc.setId === 'set-king-of-the-summit').length >= 4
      if (!active && semantics.critRate)
        semantics.critRate = { ...semantics.critRate, requirement: 'optional' }
      applied.push(active ? '山大王四件套：暴击率目标50%' : '未使用山大王四件套：不要求50%暴击率')
    }
    if (rule === 'ap-engine') {
      const secondary = currentPanelData.wEngines[input.engineId]?.secondary
      if (!secondary) exclude('anomalyProficiency', '音擎主属性无法核对，异常精通目标未计入')
      else if (secondary.key === 'anomalyProficiency') {
        const base = value.anomalyProficiency
        if (typeof base === 'number') value.anomalyProficiency = base + 90
        else if (base && typeof base === 'object') {
          const range = base as { min?: number; max?: number }
          value.anomalyProficiency = {
            ...range,
            ...(range.min === undefined ? {} : { min: range.min + 90 }),
            ...(range.max === undefined ? {} : { max: range.max + 90 }),
          }
        }
        applied.push('异常精通主属性音擎：毕业精通目标提高90点')
      } else applied.push('非异常精通主属性音擎：使用基础精通目标')
    }
    if (rule === 'skill') {
      const variants = source.sourceVariants ?? []
      const match = variants
        .map((text) => text.match(/^ATK (\d+) at (Special Lv|Core Passive Level )(\d+)$/))
        .find(
          (entry) =>
            entry &&
            Number(entry[3]) ===
              (entry[2] === 'Special Lv'
                ? input.agent.skillLevels.special
                : (input.agent.skillLevels.core ?? 0) - 1),
        )
      if (match) {
        value.atk = Number(match[1])
        semantics.atk = {
          requirement: 'required',
          boundary: 'minimum',
          observation: 'out_of_combat',
        }
        applied.push(`按当前技能等级匹配攻击力目标${match[1]}`)
      } else limitations.push('当前技能等级没有对应的攻击力参考分支，攻击力目标未计入')
    }
    if (rule === 'crit-context') {
      exclude('critRate', '暴击率参考含特定音擎或战斗被动，未计入局外完成度')
      if (
        input.agent.agentId === 'agent-zhu-yuan' &&
        input.discs.filter((disc) => disc.setId === 'set-chaotic-metal').length >= 4
      )
        exclude('critDamage', '混沌重金属四件套与暴伤参考口径不同，暴击伤害未计入')
    }
    if (rule === 'rina') {
      if (!mechanic) exclude('penRatio', '请录入实际核心等级，以核对相应穿透准备线；攻略方向仍保留')
    }
  }
  return { value, limitations: [...new Set(limitations)], applied }
}
