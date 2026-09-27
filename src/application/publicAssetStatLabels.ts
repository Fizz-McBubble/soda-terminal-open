import labels from './publicAssetStatLabels.data.json'

/** Presentation labels only; evaluation rules and weights remain private. */
export function publicAssetStatLabel(stat: string) {
  return labels[stat as keyof typeof labels] ?? stat
}
