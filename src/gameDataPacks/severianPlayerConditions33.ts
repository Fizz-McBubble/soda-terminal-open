import reviewed from './data/reviewed-severian-build-guidance.3.3.json'
import type { DevelopmentComparisonPanels } from '../application/publicDevelopmentComparisonPanels'

// Published 3.3 phase-II guidance. Historical combat inputs retain their original source identity.
const correction = new Map([
  [
    '追加能力暴击率超过80%的暴击伤害转化至多按超出15%计（95%封顶），需激活治安铁腕。',
    '「最优编配」生效时，每1%暴击率提供8.5点攻击力，暴击率达到100%时获得全部850点攻击力。',
  ],
  [
    'M1普通攻击、冲刺攻击、闪避反击与支援攻击无视目标12%风属性抗性；流息获取按招式触发，不默认全程满层。',
    '1影攻击命中时无视15%风抗，连携技积累50点流息。「清场时刻」每60秒可替换为连携技一次，「苍风影猎」可获得一层凭风。',
  ],
  [
    'M2苍风影猎与终结技无视防御及强化特殊技后普攻增伤单列，不推算精确抽取收益或全队DPS。',
    '2影入场回复150点流息，勘域模式每180秒限一次。极限闪避或发动「苍风影猎」后，穿透率提升20%，持续25秒。',
  ],
])

export function correctSeverianConditions(lines: readonly string[]) {
  return lines.map((line) => correction.get(line) ?? line)
}

export function severianSignatureCritCondition(
  engineId?: string | null,
  refinement?: number | null,
) {
  const { engine, additionalAbility } = reviewed.additionalAbilityCritCapReference
  if (engineId !== engine.id || typeof refinement !== 'number' || !Number.isInteger(refinement))
    return null
  const bonus = engine.passivePermanentCritRateByRefinement[refinement - 1]
  if (bonus === undefined) return null
  const required = Math.round(additionalAbility.maximumCritRatePercent - bonus * 100)
  return `当前记录装备「禁罪囚笼」${refinement}阶。只计音擎的战斗内暴击加成时，局外暴击率达到${required}%可在战斗内满暴。`
}

export function currentComparisonConditions(presentation?: DevelopmentComparisonPanels) {
  const fields = presentation?.targetConditionsByLabel
  if (!fields || presentation.agentId !== reviewed.agentId) return fields
  const reference = severianSignatureCritCondition(
    reviewed.additionalAbilityCritCapReference.engine.id,
    presentation.saveKnowledge.severianSignatureRefinement,
  )
  return Object.fromEntries(
    Object.entries(fields).map(([label, lines]) => {
      const conditions = correctSeverianConditions(lines)
      if (label === '暴击率' && reference) conditions.push(reference)
      return [label, conditions]
    }),
  )
}
