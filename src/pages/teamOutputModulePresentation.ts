import {
  teamPrimaryOutputKindLabels,
  type TeamExecutionChannel,
  type TeamOutputModule,
  type TeamReactionMechanism,
} from '../gameDataPacks/teamOutputModuleContract'

const reactionLabels: Record<TeamReactionMechanism, string> = {
  disorder: '紊乱',
  abloom: '异放',
  polarity: '极性',
  penetration: '贯穿',
  laceration: '毁伤',
  luminize: '耀变',
}

const executionLabels: Record<TeamExecutionChannel, string> = {
  stun_window: '失衡窗口',
  chain: '连携',
  ultimate: '终结技',
  off_field: '后台',
  quick_swap: '速切',
}

export function teamOutputModuleLabel(module: TeamOutputModule) {
  const characteristic = module.reactionMechanisms[0] ?? module.executionChannels[0]
  const qualifier = characteristic
    ? (reactionLabels[characteristic as TeamReactionMechanism] ??
      executionLabels[characteristic as TeamExecutionChannel])
    : null
  return [teamPrimaryOutputKindLabels[module.primaryOutputKind], qualifier]
    .filter(Boolean)
    .join(' · ')
}
