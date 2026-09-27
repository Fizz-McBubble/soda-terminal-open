import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import { reviewedTargetPanelGuidance } from '../gameDataPacks/reviewedTargetPanelGuidance'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'
import type {
  TargetPanelMetricKey,
  TargetPanelSemantics,
} from '../gameDataPacks/targetPanelSemantics'

type Rule = 'note' | 'summit' | 'ap-engine' | 'skill' | 'crit-context' | 'rina' | 'astra'
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
  'Shield caps at 3750 Initial ATK but this is a hard target.': 'note',
  'Crit Rate is before Additional Ability and Shadow Harmony; Crit DMG is before Core passive.':
    'note',
  'ATK is a Core Passive variant, so no unconditional ATK target is synthesized.': 'skill',
  'Guide marks all other stats not relevant.': 'note',
  'Impact is most important; ability caps Crit Rate at 90 with signature W-Engine.': 'crit-context',
  'Anomaly Proficiency is before combat.': 'note',
  'ATK range depends on W-Engine.': 'note',
  'Crit Rate is maximum 50% in the stat screen; upper-only constraint is preserved outside the lower-bound panel.':
    'note',
  'Pre-combat; assumes 4-piece Yunkui 12% Crit Rate and P1 Kraken 20% Crit Rate. Combat Crit Rate is 90.6-97.2.':
    'crit-context',
  'Crit Rate includes Disk Drive.': 'crit-context',
  'Prioritize ATK under 3000 then AP; Crit path differs for physical versus non-physical teams.':
    'note',
  'Crit Rate is 90-100 with Additional Ability; maximum 55 with Nicole M6. Crit DMG is without Chaotic Metal.':
    'crit-context',
}

export function resolveSavedGraduationTarget(input: {
  agent: RosterAgent
  engineId: string
  discs: readonly DriveDisc[]
  target: { value: unknown; conditions: readonly string[]; sourceRefs?: readonly { id: string }[] }
}) {
  if (
    input.agent.agentId === 'agent-sigrid' &&
    input.target.sourceRefs?.some((ref) => ref.id === 'prydwen-sigrid-live-build-2026-09-04') &&
    JSON.stringify(input.target.conditions) ===
      JSON.stringify([
        '60 级局外角色面板；暴击率 33.8% 按核心被动最多提供 66% 计算，继续堆叠可能溢出。',
        '暴击伤害区间受音擎副属性与 4 号位选择影响；这是攻略参考区间，不是 Formal 或唯一毕业线。',
      ])
  ) {
    const value = { ...(input.target.value as Record<string, unknown>) }
    // The reference assumes the maximum passive; do not infer it at lower core levels.
    if (input.agent.skillLevels.core !== 7) delete value.critRate
    return {
      value,
      limitations: input.agent.skillLevels.core === 7 ? [] : ['核心技未达F，暴击率参考未计入'],
      applied: ['按局外面板与毕业参考下限比较'],
    }
  }
  const reviewed = reviewedTargetPanelGuidance(input.agent.agentId)
  const source = input.target.value as {
    sourceMetadata?: { sourceId?: string; sourceConditions?: string[] }
    sourceVariants?: string[]
    targetSemantics?: TargetPanelSemantics
    extraStats?: Record<string, unknown>
  } | null
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
    if (rule === 'astra' && input.agent.skillLevels.core !== 7)
      exclude('atk', '核心技未达F，最高全队增益的攻击力目标未计入')
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
      if (input.agent.skillLevels.core !== 7)
        exclude('penRatio', '丽娜的完整增益目标要求核心技F，穿透率目标未计入')
      else applied.push('已按核心技F核对穿透率参考范围')
    }
  }
  return { value, limitations: [...new Set(limitations)], applied }
}
