import type { RosterAgent } from '../assault/types'
import { getMindscapeSkillLevelBonus } from '../accounts/agentProgressionRules'
import {
  evaluateSkillInvestmentNextLevel,
  type SkillInvestmentBlockReason,
  type SkillInvestmentMissingInput,
} from '../calculation/skillInvestmentNextLevel'
import type { SkillKey } from '../calculation/skillInvestmentPolicy'

export const skillInvestmentMindscapeSource = Object.freeze({
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  path: 'libs/zzz/formula/src/data/char/util.ts',
  sha256: '1DF008B73CFC3D9CCED15D3DEEC596E0E99483DAA3874088DC1CA27E7C4237DC',
  locator: '462-467: allSkillKeys, mindscape >=5 +4, >=3 +2',
})

export function resolveSkillInvestmentMindscapeBonus(mindscape: number | null) {
  if (mindscape === null || !Number.isInteger(mindscape) || mindscape < 0 || mindscape > 6)
    return null
  return getMindscapeSkillLevelBonus('basic', mindscape)
}

export type SkillNextLevelDisplay = {
  status: 'supported' | 'partial' | 'no_upgrade' | 'unknown' | 'unsupported'
  title: string
  fromLevel: number | null
  toLevel: number | null
  fromBaseLevel: number | null
  toBaseLevel: number | null
  gainText: string
  materialsText: string
  tooltip: string
  reasonCode?: SkillInvestmentBlockReason
  nextAction?: string
  missingInputs?: readonly SkillInvestmentMissingInput[]
}

const blockedSkillDisplay: Record<
  SkillInvestmentBlockReason,
  {
    title: string
    message: string
    action: string
  }
> = {
  current_level_unknown: {
    title: '当前等级未记录',
    message: '当前技能等级未记录，暂不能评估下一等级。',
    action: '补充当前技能等级后重新查看。',
  },
  target_level_unknown: {
    title: '投入目标待确认',
    message: '实际投入目标待确认，暂不计算下一等级收益。',
    action: '推荐等级仍可作为培养参考。',
  },
  current_and_target_unknown: {
    title: '等级与目标待确认',
    message: '当前技能等级未记录，实际投入目标也待确认。',
    action: '先补充当前等级，再核对培养目标。',
  },
  mindscape_bonus_unknown: {
    title: '影画加成待确认',
    message: '影画技能加成未确认，暂不能换算基础等级和升级消耗。',
    action: '确认当前影画后重新查看，已有技能等级保持不变。',
  },
  invalid_levels: {
    title: '等级需要核对',
    message: '当前技能等级或培养目标不是有效等级。',
    action: '核对当前记录和培养目标后重新查看。',
  },
  event_contract_unavailable: {
    title: '升级收益待补齐',
    message: '这位代理人的技能收益资料尚未齐全。',
    action: '推荐等级仍可参考，暂不据此比较升级收益。',
  },
  invalid_mindscape_bonus: {
    title: '影画加成需要核对',
    message: '记录的影画技能加成与当前技能不符。',
    action: '核对影画和技能等级后重新查看。',
  },
  level_out_of_bounds: {
    title: '等级超出范围',
    message: '当前技能等级或培养目标超出了该技能支持的等级范围。',
    action: '核对基础等级、影画加成和培养目标。',
  },
  core_growth_unavailable: {
    title: '核心成长待补齐',
    message: '此等级的核心技成长资料尚未齐全。',
    action: '暂不据此推算属性和伤害收益。',
  },
  skill_events_unavailable: {
    title: '技能收益待补齐',
    message: '这项技能的具体动作收益尚不能评估。',
    action: '推荐等级仍可参考，暂不据此比较升级收益。',
  },
}

const coreAttributes: Record<string, { label: string; percent?: boolean }> = {
  hp: { label: '生命值' },
  atk: { label: '攻击力' },
  atkPercent: { label: '攻击力', percent: true },
  hpPercent: { label: '生命值', percent: true },
  critRate: { label: '暴击率', percent: true },
  critDamage: { label: '暴击伤害', percent: true },
  anomalyMastery: { label: '异常掌控' },
  anomalyMasteryPercent: { label: '异常掌控', percent: true },
  anomalyProficiency: { label: '异常精通' },
  impact: { label: '冲击力' },
  impactPercent: { label: '冲击力', percent: true },
  penRatio: { label: '穿透率', percent: true },
  energyRegenPercent: { label: '能量自动回复', percent: true },
  energyRegenFlat: { label: '能量自动回复' },
}

function formatPercent(value: number): string {
  const percent = value * 100
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1).replace(/\.0$/, '')}%`
}

function formatMaterialsText(
  materials: ReturnType<typeof evaluateSkillInvestmentNextLevel>['materials'],
): string {
  if (!materials) return ''
  if (materials.status === 'unknown') return '材料待核验'
  const items: string[] = []
  for (const item of materials.materials) {
    if (item.kind === 'denny') {
      items.push(`丁尼 ×${item.quantity.toLocaleString('zh-CN')}`)
    } else if (item.kind === 'attribute_chip') {
      const gradeLabel = item.grade === 3 ? '高级芯片' : item.grade === 2 ? '中级芯片' : '初级芯片'
      items.push(`${gradeLabel} ×${item.quantity}`)
    } else if (item.kind === 'hamster_cage_pass') {
      items.push(`仓鼠笼访问器 ×${item.quantity}`)
    } else if (item.kind === 'expert_challenge') {
      items.push(`高维材料 ×${item.quantity}`)
    } else if (item.kind === 'notorious_hunt') {
      items.push(`周本材料 ×${item.quantity}`)
    }
  }
  return items.join('、')
}

/**
 * Projects a concise, serializable display of the next level for Popover and title attributes.
 * Avoids long raw event dictionaries; preserves unrated/unknown states without false zeros.
 */
export function projectSkillNextLevelDisplay(
  evidence: ReturnType<typeof evaluateSkillInvestmentNextLevel>,
): SkillNextLevelDisplay {
  const materialsText = formatMaterialsText(evidence.materials)

  if (evidence.status === 'no_upgrade') {
    return {
      status: 'no_upgrade',
      title: '已达标',
      fromLevel: null,
      toLevel: null,
      fromBaseLevel: null,
      toBaseLevel: null,
      gainText: '当前等级已达到推荐目标或技能上限。',
      materialsText: '',
      tooltip: '当前等级已达到推荐目标或技能上限。',
    }
  }

  if (evidence.status === 'unknown' || evidence.status === 'unsupported') {
    const copy = blockedSkillDisplay[evidence.reasonCode]
    const bonusMissingAlongsideLevels =
      evidence.reasonCode !== 'mindscape_bonus_unknown' &&
      evidence.missingInputs.includes('mindscape_bonus')
    const message = [
      copy.message,
      bonusMissingAlongsideLevels ? '影画技能加成也未确认，暂不能换算基础等级。' : '',
    ]
      .filter(Boolean)
      .join(' ')
    const currentLevel =
      Number.isInteger(evidence.currentLevel) &&
      evidence.currentLevel !== null &&
      evidence.currentLevel >= 1
        ? evidence.currentLevel
        : null
    return {
      status: evidence.status,
      reasonCode: evidence.reasonCode,
      missingInputs: evidence.missingInputs,
      title: copy.title,
      fromLevel: currentLevel,
      toLevel: null,
      fromBaseLevel: null,
      toBaseLevel: null,
      gainText: message,
      materialsText: '',
      nextAction: copy.action,
      tooltip: [currentLevel === null ? '' : `当前技能 Lv.${currentLevel}。`, message, copy.action]
        .filter(Boolean)
        .join(' '),
    }
  }

  const fromLevel = evidence.fromLevel ?? null
  const toLevel = evidence.toLevel ?? null
  const fromBaseLevel = evidence.fromBaseLevel ?? null
  const toBaseLevel = evidence.toBaseLevel ?? null
  const title =
    fromLevel != null && toLevel != null ? `Lv.${fromLevel} → Lv.${toLevel}` : '下一等级'

  let gainText = ''
  if ('coreGrowth' in evidence && evidence.coreGrowth) {
    const growths: string[] = []
    for (const [key, diff] of Object.entries(evidence.coreGrowth)) {
      const attribute = coreAttributes[key]
      if (!attribute || diff.delta === 0) continue
      // Panel growth already uses percentage points, unlike event coefficients.
      const amount = Number(diff.delta.toFixed(2))
      growths.push(
        `${attribute.label} ${amount > 0 ? '+' : ''}${amount}${attribute.percent ? '%' : ''}`,
      )
    }
    gainText = growths.length ? `${growths.join('，')}（静态成长）` : '本级没有额外面板属性。'
  } else if ('events' in evidence && Array.isArray(evidence.events)) {
    const supportedEvents = evidence.events.filter((e) => e.status === 'supported')
    const coefficientRange = (
      key: 'damageCoefficient' | 'dazeCoefficient' | 'anomalyCoefficient',
      label: string,
    ) => {
      const gains = supportedEvents.flatMap((event) => {
        const value = event.status === 'supported' ? event[key]?.relativeGain : null
        return value == null || !Number.isFinite(value) || value <= 0 ? [] : [value]
      })
      if (!gains.length) return ''
      const min = formatPercent(Math.min(...gains))
      const max = formatPercent(Math.max(...gains))
      return `${label} +${min}${min === max ? '' : `～${max}`}`
    }
    const resourceRange = () => {
      const energyGains = supportedEvents.flatMap((event) => {
        const deltaVal =
          event.status === 'supported' ? event.resourceRecoveryGains?.energy?.delta : null
        return deltaVal && deltaVal > 0 ? [deltaVal] : []
      })
      const decibelGains = supportedEvents.flatMap((event) => {
        const deltaVal =
          event.status === 'supported' ? event.resourceRecoveryGains?.decibels?.delta : null
        return deltaVal && deltaVal > 0 ? [deltaVal] : []
      })
      const res: string[] = []
      if (energyGains.length) {
        const min = Math.min(...energyGains)
        const max = Math.max(...energyGains)
        res.push(`能量积蓄 +${min === max ? min : `${min}～${max}`}`)
      }
      if (decibelGains.length) {
        const min = Math.min(...decibelGains)
        const max = Math.max(...decibelGains)
        res.push(`喧响值 +${min === max ? min : `${min}～${max}`}`)
      }
      return res.join('，')
    }
    const parts = [
      coefficientRange('damageCoefficient', '伤害倍率'),
      coefficientRange('dazeCoefficient', '失衡倍率'),
      coefficientRange('anomalyCoefficient', '属性积蓄'),
      resourceRange(),
    ].filter(Boolean)
    gainText = parts.join('，') || '本级没有可对比的技能倍率。'
    if (parts.length && evidence.status === 'partial') gainText += '（已覆盖招式）'
  }

  const tooltipParts = [`下一级 ${title}`]
  if (gainText) tooltipParts.push(gainText)
  if (materialsText) tooltipParts.push(`消耗：${materialsText}`)
  const tooltip = tooltipParts.join(' · ')

  return {
    status: evidence.status,
    title,
    fromLevel,
    toLevel,
    fromBaseLevel,
    toBaseLevel,
    gainText,
    materialsText,
    tooltip,
  }
}

/** Preserves caller order, priority and targets. Rows must already declare effective targets.
 * Account defaults (including A-rank effective 15) remain input; this does not alter the roster. */
export function projectSkillInvestmentNextLevels<
  T extends { key: SkillKey; targetLevel: number | null },
>(input: {
  agentId: string
  skillLevels: RosterAgent['skillLevels']
  mindscape: number | null
  rows: readonly T[]
}) {
  const bonus = resolveSkillInvestmentMindscapeBonus(input.mindscape)
  return input.rows.map((row) => {
    const nextLevelEvidence = evaluateSkillInvestmentNextLevel({
      agentId: input.agentId,
      skill: row.key,
      currentLevel: input.skillLevels[row.key],
      targetLevel: row.targetLevel,
      effectiveLevelBonus: row.key === 'core' ? 0 : bonus,
    })
    const nextLevel = projectSkillNextLevelDisplay(nextLevelEvidence)
    return {
      ...row,
      nextLevelEvidence,
      nextLevel,
    }
  })
}
