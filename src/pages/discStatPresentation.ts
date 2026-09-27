import type { StatKey } from '../domain/schemas'
import { getPublicSubStatUnit } from '../application/publicCandidateLabels'

function displayNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function formatRecordedDiscStatValue(stat: StatKey, value: number) {
  const unit = getPublicSubStatUnit(stat)
  return `${displayNumber(value)}${unit === 'percent' ? '%' : ''}`
}

export function formatRecordedDiscSubStat(stat: StatKey, value: number, upgrades: number) {
  const enhancement = upgrades > 0 ? ` · 强化 ${upgrades} 次` : ''
  return `${formatRecordedDiscStatValue(stat, value)}${enhancement}`
}
