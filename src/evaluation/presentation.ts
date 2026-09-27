import type { Conclusion, EvaluationSnapshot } from './types'
import { gameData } from '../data/gameData'
import { evaluationRules, getProfile } from './rules'

export const conclusionPresentation: Record<
  Conclusion,
  { label: string; grade: 'S' | 'A' | 'B' | 'C'; recommendation: string; tone: string }
> = {
  treasure: { label: '珍藏', grade: 'S', recommendation: '强烈保留并锁定', tone: 'excellent' },
  keep: { label: '保留', grade: 'A', recommendation: '建议保留', tone: 'good' },
  enhance: { label: '继续强化', grade: 'A', recommendation: '值得投入到下一节点', tone: 'good' },
  observe: { label: '观察', grade: 'B', recommendation: '保留并在下一节点复评', tone: 'watch' },
  conditional_keep: {
    label: '条件保留',
    grade: 'B',
    recommendation: '有合适角色或缺少替代品时保留',
    tone: 'watch',
  },
  stop_enhancing: {
    label: '停止强化',
    grade: 'C',
    recommendation: '不再投入材料，暂存或处理',
    tone: 'low',
  },
  low_priority: {
    label: '低优先级',
    grade: 'C',
    recommendation: '替代品充足时可处理',
    tone: 'low',
  },
}

const technicalReasonPattern = /原始分|归一化|模板适配|期望质量|理论上限|规则\s|行动结论|内部权重/

function getNextLevel(snapshot: EvaluationSnapshot) {
  return Math.min(15, snapshot.input.level + 3)
}

function getSetName(setId: string) {
  return gameData?.driveDiscSets.find((set) => set.id === setId)?.name ?? setId
}

function getProfileName(snapshot: EvaluationSnapshot) {
  if (!snapshot.profileId) return null
  try {
    return getProfile(snapshot.profileId).name.split('·')[0]?.trim() || null
  } catch {
    return null
  }
}

export function getActionCopy(snapshot: EvaluationSnapshot) {
  const nextLevel = getNextLevel(snapshot)
  switch (snapshot.conclusion) {
    case 'treasure':
    case 'keep':
      return { action: '锁定保留，这张已经成型。', nextStep: '锁定并归档。' }
    case 'enhance':
      return {
        action: `继续强化到 +${nextLevel}，再看一次。`,
        nextStep: `进入 +${nextLevel} 复评。`,
      }
    case 'observe':
      return {
        action: `先留到 +${nextLevel} 观察，不要一次拉满。`,
        nextStep: `强化到 +${nextLevel} 后复评。`,
      }
    case 'conditional_keep':
      return {
        action: '先保留，等有合适角色再决定。',
        nextStep: '暂存归档，切换专用模板后再判断。',
      }
    case 'stop_enhancing':
      return {
        action: '停止强化，先不要继续投入。',
        nextStep: '暂存归档，有替代品后再处理。',
      }
    case 'low_priority':
      return {
        action: '停止投入，仓库紧张时优先处理。',
        nextStep: '暂存归档；有替代品后再处理。',
      }
  }
}

export function buildPlayerReasons(snapshot: EvaluationSnapshot) {
  const upgraded = snapshot.input.subStats
    .filter((item) => item.upgrades > 0)
    .sort((left, right) => right.upgrades - left.upgrades)
  const useful = snapshot.qualityScore.contributions
    .filter((item) => item.source === 'sub_stat' && item.weight >= 0.75)
    .slice(0, 3)
    .map((item) => item.label)
  const mainStat = evaluationRules.stats[snapshot.input.mainStat]?.label ?? snapshot.input.mainStat
  const setName = getSetName(snapshot.input.setId)
  const profileName = getProfileName(snapshot)
  const nextLevel = getNextLevel(snapshot)
  const isLowPriority = ['stop_enhancing', 'low_priority'].includes(snapshot.conclusion)
  const isStrongFit = ['treasure', 'keep', 'enhance'].includes(snapshot.conclusion)
  const reasons: string[] = []

  if (upgraded.length > 0) {
    const top = upgraded.slice(0, 2).map((item) => {
      const label = evaluationRules.stats[item.stat]?.label ?? item.stat
      return `${label}吃到 ${item.upgrades} 次强化`
    })
    reasons.push(isLowPriority ? `${top.join('，')}，但整体收益仍不足。` : `${top.join('，')}。`)
  } else if (useful.length > 0) {
    reasons.push(`${useful.join('、')}都是可用副词条。`)
  } else {
    const weakest = snapshot.input.subStats.slice(0, 2).map((item) => {
      return evaluationRules.stats[item.stat]?.label ?? item.stat
    })
    reasons.push(`当前强化主要落在${weakest.join('、')}等低收益词条。`)
  }

  if (profileName) {
    reasons.push(
      isStrongFit
        ? `${mainStat}主词条与${setName}适合${profileName}。`
        : isLowPriority
          ? `${mainStat}主词条与${setName}对${profileName}的适配有限。`
          : `${mainStat}主词条与${setName}对${profileName}有一定适配，仍需观察。`,
    )
  } else {
    reasons.push(
      isStrongFit
        ? `${mainStat}主词条与${setName}的通用搭配可用。`
        : isLowPriority
          ? `${mainStat}主词条与${setName}的通用搭配优势不明显。`
          : `${mainStat}主词条与${setName}有一定通用价值，仍需观察。`,
    )
  }

  if (snapshot.input.level >= 15) {
    reasons.push('已到 +15，没有继续改善的强化空间。')
  } else if (snapshot.conclusion === 'observe') {
    reasons.push(`到 +${nextLevel} 命中有效词条再继续，否则停止投入。`)
  } else if (snapshot.conclusion === 'stop_enhancing') {
    reasons.push(`剩余节点不值得继续投入，先停在 +${snapshot.input.level}。`)
  } else {
    reasons.push(
      `还有 ${snapshot.potential.remainingEnhancementNodes} 个强化节点，先看 +${nextLevel} 的落点。`,
    )
  }

  return reasons.slice(0, 3)
}

export function getPlayerReasons(snapshot: EvaluationSnapshot) {
  const stored = snapshot.reasons?.slice(0, 3) ?? []
  if (stored.length > 0 && stored.every((reason) => !technicalReasonPattern.test(reason))) {
    return stored
  }
  return buildPlayerReasons(snapshot)
}

export function getPotentialRating(snapshot: EvaluationSnapshot) {
  const score = Math.round(
    Math.min(snapshot.potential.expected, snapshot.selectedFitScore.normalized),
  )
  const grade = score >= 80 ? 'S' : score >= 65 ? 'A' : score >= 45 ? 'B' : 'C'
  return { grade, score }
}

export function getDecisionBasis(snapshot: EvaluationSnapshot) {
  const fit = Math.round(snapshot.selectedFitScore.normalized)
  const expected = Math.round(snapshot.potential.expected)
  const ideal = Math.round(snapshot.potential.ideal)

  if (snapshot.conclusion === 'stop_enhancing') {
    if (fit < expected) {
      return `理论质量上限可到 ${ideal}，但当前模板适配仅 ${fit}，可兑现价值受限，因此不建议继续投入。`
    }
    return `理论质量上限可到 ${ideal}，但按当前词条分布，期望质量仅 ${expected}，继续投入的收益不足。`
  }
  if (snapshot.conclusion === 'observe') {
    return `当前可兑现潜力为 ${Math.min(expected, fit)}，仍有提升空间，但需要下一次真实强化结果确认。`
  }
  if (snapshot.conclusion === 'enhance') {
    return `期望质量 ${expected}、模板适配 ${fit} 均达到继续投入条件，建议推进一个强化节点后复评。`
  }
  if (snapshot.input.level === 15) {
    return `已完成强化，结论依据当前质量 ${Math.round(snapshot.qualityScore.normalized)} 与模板适配 ${fit}。`
  }
  return `结论依据当前质量、模板适配和剩余强化空间共同判断。`
}

export function getOverallScore(snapshot: EvaluationSnapshot) {
  return Math.round((snapshot.qualityScore.normalized + snapshot.selectedFitScore.normalized) / 2)
}

export function getSnapshotDifference(
  current: EvaluationSnapshot,
  previous?: EvaluationSnapshot | null,
) {
  if (!previous) return null
  return {
    level: current.input.level - previous.input.level,
    quality: Math.round(current.qualityScore.normalized - previous.qualityScore.normalized),
    fit: Math.round(current.selectedFitScore.normalized - previous.selectedFitScore.normalized),
    potential: Math.round(current.potential.expected - previous.potential.expected),
  }
}
