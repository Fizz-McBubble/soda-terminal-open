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
  if (recommended.trim() === 'F') return '7'
  const level = recommended.match(/(\d+)(\+?)(?!.*\d)/)
  return level ? `${level[2] ? '≥' : ''}${level[1]}` : recommended
}
