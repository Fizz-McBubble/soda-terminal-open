import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import type { Member } from './teamStrengthMemberFacts'
import type { TeamStrengthSourceAction } from './teamStrengthActionFacts'

/** Source event bindings, never actor eligibility, tier or throughput weights. */
const bindings = {
  'agent-vivian': {
    formulaSha256: '89933DF78C2479BAEAD0CF1EC9100332815D549C7DBAB5DFC911EA896392500E',
    localization: 'char_Vivian_gen.json',
    localizationSha256: '23e0d9adbf300d3aec88b61f96fcc82f8aa2b3b6ab0d77ca6aaf1625b1e1a0a4',
    locator: '/basic/BasicAttackFeatherbloom/desc/0',
    actions: ['BasicAttackFeatherbloom'],
    preparedConditions: ['one Guard Feather available', 'one squad EX Special hit'],
  },
  'agent-trigger': {
    formulaSha256: 'C24093AAEF041B0CA582F19729665387060E64C6CDDC9DAF7B338DA37075B0A6',
    localization: 'char_Trigger_gen.json',
    localizationSha256: '7f2afba79c80a441dd59427e40c6b1c2a7365dfeccabfe97be4f6e5d6b52c03e',
    locator:
      '/basic/BasicAttackHarmonizingShot/desc/0,/basic/BasicAttackHarmonizingShotTartarus/desc/0',
    actions: ['BasicAttackHarmonizingShot', 'BasicAttackHarmonizingShotTartarus'],
    preparedConditions: [
      'Purge available',
      'one other active squad actor hit of the declared action class',
    ],
  },
} as const

const remielleObservedBackgroundAction = {
  eventId: 'RemielleOrigin_Skill01_AirState_Back_Explode_01',
  sourceRefs: [
    'ZenlessData@462563ec:Data/_unsorted/RemielleOrigin_CardS3_Base_01.json#5770030691362130f2e94c59a7f029efe5aa2817:Skill01_AirState_Back',
    'ZenlessData@462563ec:Data/_unsorted/RemielleOrigin_Skill01_AirState_Back_Bullet.json#ee6671f1a47459cbeb74266e7fc72e054495fc23:ExplodeAnimEventID',
    'ZenlessData@462563ec:Data/_unsorted/RemielleOrigin_Skill01_AirState_Back_BulletEmitter.json#8f477300d492a629a4829b33aaa7d7cdba2f8b76:BulletAbilityName',
    'ZenlessData@462563ec:Data/_unsorted/RemielleOrigin_AirMode_BackStage.json#454dba70418ef5d53937a8cf35c4f88de96ae4fd:OnAttackLanded',
  ],
} as const

export const teamStrengthBackgroundActionPolicy = {
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  unit: 'one complete source-bound off-field action; no cadence or resource cycle',
  unbound: 'unknown execution-event binding; ordinary finite action and trio eligibility retained',
  bindings,
  observedSourceEvents: { 'agent-remielle': remielleObservedBackgroundAction },
} as const
export const teamStrengthBackgroundActionIdentity = stableContentHash(
  teamStrengthBackgroundActionPolicy,
)

export function teamStrengthBackgroundAction(member: Member) {
  const source = getCurrentAgentEventContract(member.agentId)!.source
  const binding = bindings[member.agentId as keyof typeof bindings]
  const sourceRefs = [source.formulaPath + '#' + source.formulaSha256]
  let action: TeamStrengthSourceAction | null = null
  let blockers: string[] = []
  if (binding) {
    sourceRefs.push(
      `libs/zzz/dm-localization/assets/locales/en/${binding.localization}#${binding.localizationSha256}:${binding.locator}`,
    )
    if (
      source.commit !== teamStrengthBackgroundActionPolicy.commit ||
      source.formulaSha256 !== binding.formulaSha256
    )
      blockers = ['off_field_action_source_identity_changed']
    else {
      action =
        member.actionFacts.sourceActions
          .filter(
            (row) =>
              binding.actions.some((id) => id === row.actionId) &&
              row.formulaFamily === 'standard_direct_damage' &&
              row.scalingAttribute === 'atk' &&
              row.quantities.every((quantity) => quantity.unit === 'coefficient_uses'),
          )
          .toSorted((left, right) => right.damageMultiplier - left.damageMultiplier)[0] ?? null
      if (!action) blockers = ['source_bound_off_field_packet_unavailable']
    }
  } else if (
    member.demand <= 0.3 &&
    ['attack', 'anomaly', 'rupture', 'armorer'].includes(member.specialty)
  ) {
    if (member.agentId === 'agent-remielle') {
      sourceRefs.push(...remielleObservedBackgroundAction.sourceRefs)
      blockers = [
        `source_bound_background_action_observed:${remielleObservedBackgroundAction.eventId}`,
        'off_field_execution_event_binding_missing: source files do not provide the action coefficient, selection probability, or cadence; ordinary Chain/EX packet is not proof',
      ]
    } else {
      blockers = [
        'off_field_execution_event_binding_missing; ordinary Chain/EX packet is not proof',
      ]
    }
  }
  return {
    agentId: member.agentId,
    action,
    status: action
      ? ('supported' as const)
      : blockers.length
        ? ('unknown' as const)
        : ('not_applicable' as const),
    blockers,
    sourceRefs,
    preparedConditions: binding?.preparedConditions ?? [],
  }
}
