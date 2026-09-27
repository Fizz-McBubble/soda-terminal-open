import labels from './publicCandidateLabels.data.json'

export const publicStatOrder: readonly string[] = labels.statOrder

export function getPublicStatLabel(stat: string) {
  return labels.stats[stat as keyof typeof labels.stats]
}

export function getPublicSubStatUnit(stat: string) {
  return labels.subStatUnits[stat as keyof typeof labels.subStatUnits]
}

const skillLabelByKey: Record<string, string> = {
  basic: '普通攻击',
  dodge: '闪避',
  assist: '支援技',
  special: '特殊技',
  chain: '连携技',
  core: '核心技',
}

function presentCandidateValue(
  value: string,
  resolve: (candidate: string) => string | undefined,
  category: string,
) {
  return resolve(value) ?? `${category}资料待补齐`
}

export function getCandidateWEngineLabels(ids: string[]) {
  return ids.map((id) =>
    presentCandidateValue(
      id,
      (candidate) => labels.wEngines[candidate as keyof typeof labels.wEngines],
      '音擎',
    ),
  )
}

export function getCandidateSetLabels(ids: string[]) {
  return ids.map((id) =>
    presentCandidateValue(
      id,
      (candidate) => labels.driveDiscSets[candidate as keyof typeof labels.driveDiscSets],
      '驱动盘套装',
    ),
  )
}

export function getCandidateStatLabels(ids: string[], category: '主词条' | '副词条') {
  return ids.map((id) => presentCandidateValue(id, getPublicStatLabel, category))
}

export function getCandidateSkillLabels(ids: string[]) {
  return ids.map((id) => skillLabelByKey[id] ?? '养成优先级资料待补齐')
}

/** Progression sources contain both skill keys and reviewed prose/level targets. */
export function formatCandidateSkillDirections(directions: readonly string[] = []) {
  const labels = directions
    .map((direction) => direction.trim())
    .filter(Boolean)
    .map(
      (direction) =>
        skillLabelByKey[direction] ??
        (/\p{Script=Han}/u.test(direction) ? direction : '养成建议资料待补齐'),
    )
  return [...new Set(labels)].join('；') || '养成建议资料待补齐'
}

export function formatCandidateMainStats(mainStats: Record<string, string[]>) {
  return Object.entries(mainStats)
    .map(([slot, values]) => {
      const labels = getCandidateStatLabels(values, '主词条')
      return `${slot}号位 ${labels.length ? labels.join('/') : '主词条资料待补齐'}`
    })
    .join('；')
}
