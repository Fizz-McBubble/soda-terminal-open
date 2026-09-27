import type { DriveDisc } from '../domain/schemas'

const enhancementLevels = [0, 3, 6, 9, 12, 15] as const

type SubStatHistoryInput = Pick<DriveDisc, 'level' | 'subStats'>

export type KnownSubStatHistory = {
  status: 'known'
  initialSubStatCount: 3 | 4
  usedEnhancementNodes: number
  recordedUpgradeCount: number
  actualTotalRolls: number
  remainingEnhancementNodes: number
  unlocksRemaining: 0 | 1
  remainingRollOpportunities: number
}

export type UnknownSubStatHistory = {
  status: 'unknown'
  initialSubStatCount: null
  reason:
    | 'unsupported_level'
    | 'invalid_visible_sub_stat_count'
    | 'enhanced_disc_missing_four_sub_stats'
    | 'level_zero_has_recorded_upgrades'
    | 'recorded_upgrades_do_not_match_level'
  message: string
}

export type SubStatHistory = KnownSubStatHistory | UnknownSubStatHistory

/**
 * Derives the original three/four-line state from the enhancement ledger.
 * It never awards score: callers continue to count actual rolls as
 * `upgrades + 1` for each visible sub stat.
 */
export function deriveSubStatHistory(input: SubStatHistoryInput): SubStatHistory {
  if (!Number.isInteger(input.level) || input.level < 0 || input.level > 15) {
    return {
      status: 'unknown',
      initialSubStatCount: null,
      reason: 'unsupported_level',
      message: `Unsupported enhancement level ${input.level}`,
    }
  }
  if (input.subStats.length !== 3 && input.subStats.length !== 4) {
    return {
      status: 'unknown',
      initialSubStatCount: null,
      reason: 'invalid_visible_sub_stat_count',
      message: 'A drive disc must expose three or four sub stats before evaluation',
    }
  }
  const usedEnhancementNodes = Math.floor(input.level / 3)
  if (usedEnhancementNodes > 0 && input.subStats.length !== 4) {
    return {
      status: 'unknown',
      initialSubStatCount: null,
      reason: 'enhanced_disc_missing_four_sub_stats',
      message: 'An enhanced drive disc must expose four sub stats',
    }
  }

  const recordedUpgradeCount = input.subStats.reduce((sum, subStat) => sum + subStat.upgrades, 0)
  if (usedEnhancementNodes === 0 && recordedUpgradeCount !== 0) {
    return {
      status: 'unknown',
      initialSubStatCount: null,
      reason: 'level_zero_has_recorded_upgrades',
      message: 'Recorded upgrades do not match enhancement level 0',
    }
  }

  let initialSubStatCount: 3 | 4
  if (usedEnhancementNodes === 0) {
    initialSubStatCount = input.subStats.length
  } else if (recordedUpgradeCount === usedEnhancementNodes) {
    initialSubStatCount = 4
  } else if (recordedUpgradeCount === usedEnhancementNodes - 1) {
    initialSubStatCount = 3
  } else {
    return {
      status: 'unknown',
      initialSubStatCount: null,
      reason: 'recorded_upgrades_do_not_match_level',
      message: `Recorded upgrades do not match enhancement level ${input.level}`,
    }
  }

  const remainingEnhancementNodes = enhancementLevels.filter((level) => level > input.level).length
  const unlocksRemaining = usedEnhancementNodes === 0 && initialSubStatCount === 3 ? 1 : 0
  return {
    status: 'known',
    initialSubStatCount,
    usedEnhancementNodes,
    recordedUpgradeCount,
    actualTotalRolls: input.subStats.reduce((sum, subStat) => sum + subStat.upgrades + 1, 0),
    remainingEnhancementNodes,
    unlocksRemaining,
    remainingRollOpportunities: Math.max(0, remainingEnhancementNodes - unlocksRemaining),
  }
}

export function describeInitialSubStats(history: SubStatHistory, level: number) {
  if (history.status === 'unknown') return '初始词条记录无法确认，暂不据此作清理判断'
  if (history.initialSubStatCount === 4) {
    return level >= 15
      ? '初始4词条，满级比初始3词条多1次有效强化机会'
      : '初始4词条，满级多1次有效强化机会'
  }
  return level < 3 ? '初始3词条，首次强化用于解锁第4词条' : '初始3词条，首次强化已用于解锁第4词条'
}
