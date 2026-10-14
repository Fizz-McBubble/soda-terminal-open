export const specialtyIconIds: Record<string, { entityId: string; name: string }> = {
  锋御: { entityId: 'specialty-armorer', name: '锋御特性' },
  异常: { entityId: 'specialty-anomaly', name: '异常特性' },
  强攻: { entityId: 'specialty-attack', name: '强攻特性' },
  防护: { entityId: 'specialty-defense', name: '防护特性' },
  命破: { entityId: 'specialty-rupture', name: '命破特性' },
  击破: { entityId: 'specialty-stun', name: '击破特性' },
  支援: { entityId: 'specialty-support', name: '支援特性' },
}

export function presentationTargetLevel(recommended: string) {
  // F is the canonical seven-level core cap. A source's '+' is a minimum,
  // never permission to round the target up to the next exact level.
  const trimmed = recommended.trim()
  if (/^(?:核心技|核心)?(?:优先升至\s*)?[≥>=]*F\+?$/i.test(trimmed)) {
    return /[+≥>]/u.test(trimmed) ? '≥7' : '7'
  }
  const isMinimum = trimmed.startsWith('≥') || trimmed.startsWith('>=') || trimmed.includes('+')
  const level = trimmed.match(/(\d+)/)
  return level ? `${isMinimum ? '≥' : ''}${level[1]}` : recommended
}
