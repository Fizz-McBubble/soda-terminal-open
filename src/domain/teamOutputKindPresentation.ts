export type TeamPrimaryOutputKind =
  | 'direct_damage'
  | 'attribute_anomaly'
  | 'rupture'
  | 'aftershock'
  | 'sharp'

export const teamPrimaryOutputKindLabels: Record<TeamPrimaryOutputKind, string> = {
  direct_damage: '直伤',
  attribute_anomaly: '属性异常',
  rupture: '命破',
  aftershock: '追加攻击',
  sharp: '锋御',
}
