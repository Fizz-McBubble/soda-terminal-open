export const specialtyIconIds: Record<string, { entityId: string; name: string }> = {
  异常: { entityId: 'specialty-anomaly', name: '异常特性' },
  强攻: { entityId: 'specialty-attack', name: '强攻特性' },
  防护: { entityId: 'specialty-defense', name: '防护特性' },
  命破: { entityId: 'specialty-rupture', name: '命破特性' },
  击破: { entityId: 'specialty-stun', name: '击破特性' },
  支援: { entityId: 'specialty-support', name: '支援特性' },
}

export function presentationTargetLevel(recommended: string) {
  return recommended.match(/(\d+\+?)(?!.*\d)/)?.[1] ?? recommended
}
