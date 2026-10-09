import { stableContentHash } from '../gameDataPacks/types'
import reviewedSources from '../gameDataPacks/data/reviewed-mechanism-point-grants32.v1.json'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import {
  currentAgentMechanicIdentity,
  evaluateCurrentAgentTeamActivation,
  getCurrentAgentEventContract,
} from './currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'

/** Action triggers are distinct from coefficient rows: multi-hit damage cannot
 * grant an action's launch bonus repeatedly. These are internal observations. */
export type SourceResourceGrantTrigger32 = {
  id: string
  providerAgentId: string
  mechanism:
    | 'anby_additional_dodge_counter_energy'
    | 'claret_contamination_decibels'
    | 'roxy_investigation_entry_energy'
    | 'reviewed_support_ultimate_energy'
    | 'yidhari_hp_loss_decibels'
    | 'yuzuha_ultimate_energy'
    | 'yuzuha_m1_investigation_entry_energy'
  atSeconds: number
  /** Source-stated HP percentage lost at this event, not a net start/end delta. */
  hpLossPercent?: number
  /** Next actual switch after this ultimate. null explicitly declares none in
   * this window; absence leaves the additional grant unknown. */
  nextSwitchIn?: { agentId: string; atSeconds: number } | null
  sourceRefs: readonly string[]
}
export type SourceResourceGrantDeclaration32 = {
  authority: 'declared_resource_triggers'
  durationSeconds: number
  /** null means no preceding trigger; missing is unknown. A preceding time
   * must not be later than the window start. */
  lastTriggerAtSeconds: Readonly<Record<string, number | null>>
  triggers: readonly SourceResourceGrantTrigger32[]
  sourceRefs: readonly string[]
}
const specifications = {
  anby_additional_dodge_counter_energy: {
    agentId: 'agent-anby',
    amountKey: 'additional_dodge_counter_energy',
    amount: 7.2,
    cooldownKey: 'additional_energy_cooldown_seconds',
    cooldown: 5,
    unit: 'energy_points' as const,
  },
  claret_contamination_decibels: {
    agentId: 'agent-claret',
    amountKey: 'contamination_decibel_gain',
    amount: 300,
    cooldownKey: 'contamination_decibel_cooldown_seconds',
    cooldown: 18,
    unit: 'decibel_points' as const,
  },
  roxy_investigation_entry_energy: {
    agentId: 'agent-roxy',
    amountKey: 'energy_enter_gain',
    amount: 40,
    cooldownKey: 'energy_enter_investigation_cooldown_seconds',
    cooldown: 180,
    unit: 'energy_points' as const,
  },
} as const
const extendedSpecifications = {
  yidhari_hp_loss_decibels: { agentId: 'agent-yidhari', unit: 'decibel_points' as const },
  yuzuha_ultimate_energy: { agentId: 'agent-yuzuha', unit: 'energy_points' as const },
  yuzuha_m1_investigation_entry_energy: { agentId: 'agent-yuzuha', unit: 'energy_points' as const },
} as const
export const sourceMechanismResourceGrantIdentity32 = Object.freeze({
  revision: 'declared-source-point-grants-r2',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  specifications,
  extendedSpecifications,
  reviewedSources,
  boundary:
    'Only listed source-bound nominal grants, separate from unconverted hit fields and actual receipt.',
})
type Grant32 = { agentId: string; atSeconds: number | null; nominalValue: number | null }

/** Consume retained parameters with explicit triggers and cooldown history.
 * Unknown receipt, overflow and resource feasibility are not invented. */
export function summarizeSourceMechanismResourceGrants32(input: {
  members: readonly PlanningEffectRuntimeMember[]
  declaration?: SourceResourceGrantDeclaration32
}) {
  const declaration = input.declaration
  const memberIds = input.members.map((row) => row.agentId)
  const issues: string[] = []
  if (
    !declaration ||
    declaration.authority !== 'declared_resource_triggers' ||
    !Number.isFinite(declaration.durationSeconds) ||
    declaration.durationSeconds <= 0 ||
    !declaration.sourceRefs.length ||
    declaration.sourceRefs.some((ref) => !ref.trim())
  )
    issues.push('resource_grant_declaration_missing_or_invalid')
  if (
    !memberIds.length ||
    memberIds.length > 3 ||
    new Set(memberIds).size !== memberIds.length ||
    reviewedSources.commit !== sourceMechanismResourceGrantIdentity32.commit ||
    currentAgentMechanicIdentity.upstreamCommit !== reviewedSources.commit
  )
    issues.push('resource_grant_member_or_source_binding_invalid')
  const declarationInvalid = issues.length > 0
  const ids = new Set<string>()
  const last = new Map<string, number | null>()
  const switchUseCounts = new Map<string, number>()
  const switchKey = (next: { agentId: string; atSeconds: number }) =>
    JSON.stringify([next.agentId, next.atSeconds])
  for (const trigger of declaration?.triggers ?? []) {
    if (trigger.mechanism === 'reviewed_support_ultimate_energy' && trigger.nextSwitchIn) {
      const key = switchKey(trigger.nextSwitchIn)
      switchUseCounts.set(key, (switchUseCounts.get(key) ?? 0) + 1)
    }
  }
  const rows = [...(declaration?.triggers ?? [])]
    .sort((a, b) => a.atSeconds - b.atSeconds)
    .map((trigger) => {
      const isSupport = trigger.mechanism === 'reviewed_support_ultimate_energy'
      const support = isSupport
        ? reviewedSources.supportUltimates.find((row) => row.agentId === trigger.providerAgentId)
        : undefined
      const spec = isSupport
        ? undefined
        : specifications[trigger.mechanism as keyof typeof specifications]
      const extended =
        extendedSpecifications[trigger.mechanism as keyof typeof extendedSpecifications]
      const errors: string[] = []
      if (
        (!spec && !support && !extended) ||
        !trigger.id ||
        ids.has(trigger.id) ||
        (spec && trigger.providerAgentId !== spec.agentId) ||
        (extended && trigger.providerAgentId !== extended.agentId) ||
        !memberIds.includes(trigger.providerAgentId) ||
        !Number.isFinite(trigger.atSeconds) ||
        trigger.atSeconds < 0 ||
        trigger.atSeconds >= (declaration?.durationSeconds ?? 0) ||
        !trigger.sourceRefs.length ||
        trigger.sourceRefs.some((ref) => !ref.trim())
      )
        errors.push('invalid_or_duplicate_resource_grant_trigger')
      ids.add(trigger.id)
      const contract = getCurrentAgentDecisionMechanicContract(
        trigger.providerAgentId,
      )?.resourceContract
      const parameters = contract?.resourceFlow.parameters as Record<string, unknown> | undefined
      const descriptionSource = spec ? reviewedSources.mechanismSources[spec.agentId] : undefined
      const contractSource = contract?.source
      const sourceBound =
        Boolean(contractSource?.profileHash) ||
        Boolean(
          descriptionSource &&
          contractSource?.commit === reviewedSources.commit &&
          contractSource.path?.endsWith(descriptionSource.path) &&
          contractSource.contentHash?.toLowerCase() === descriptionSource.sha256,
        )
      if (
        spec &&
        (!sourceBound ||
          parameters?.[spec.amountKey] !== spec.amount ||
          parameters?.[spec.cooldownKey] !== spec.cooldown)
      )
        errors.push('resource_grant_parameter_source_unbound')
      let active: boolean | null = true
      if (spec) {
        const provider = input.members.find((row) => row.agentId === trigger.providerAgentId)
        const activation = evaluateCurrentAgentTeamActivation({
          stableId: trigger.providerAgentId,
          memberIds,
          agentState: { mindscape: provider?.mindscape, potentialImage: provider?.potential },
        })
        active = activation.status === 'supported' ? activation.active : null
        if (active === null) errors.push('resource_grant_additional_ability_unresolved')
      }
      const grants: Grant32[] = []
      let state: 'unknown' | 'granted' | 'inactive' | 'cooldown' = 'unknown'
      if (spec) {
        const key = trigger.providerAgentId + ':' + trigger.mechanism
        if (!last.has(key)) {
          const prior = declaration?.lastTriggerAtSeconds[key]
          if (prior === null || (typeof prior === 'number' && Number.isFinite(prior) && prior <= 0))
            last.set(key, prior)
          else if (active !== false) errors.push('resource_grant_initial_cooldown_unknown')
        }
        const ready =
          last.has(key) &&
          (last.get(key) === null || trigger.atSeconds - last.get(key)! >= spec.cooldown)
        const value =
          declarationInvalid || errors.length || active === null
            ? null
            : active && ready
              ? spec.amount
              : 0
        if (value !== null && value > 0) last.set(key, trigger.atSeconds)
        state =
          value === null
            ? 'unknown'
            : value > 0
              ? 'granted'
              : active === false
                ? 'inactive'
                : 'cooldown'
        grants.push({ agentId: spec.agentId, atSeconds: trigger.atSeconds, nominalValue: value })
      } else if (extended) {
        const provider = input.members.find((row) => row.agentId === trigger.providerAgentId)!
        const eventSource = getCurrentAgentEventContract(extended.agentId)?.source
        const source = reviewedSources.extendedMechanismSources[extended.agentId]
        const retained = getCurrentAgentDecisionMechanicContract(extended.agentId)
        const references = retained?.effectContract.runtimeDefaults.references as
          | Record<string, unknown>
          | undefined
        if (
          eventSource?.commit !== reviewedSources.commit ||
          eventSource.statsSha256.toLowerCase() !== source.statsSha256 ||
          eventSource.formulaSha256.toLowerCase() !== source.formulaSha256
        )
          errors.push('resource_grant_extended_source_unbound')
        let value: number | null = null
        if (trigger.mechanism === 'yidhari_hp_loss_decibels') {
          if (
            parameters?.decibels_per_hp_percent_lost !== 10 ||
            references?.['dm.core.decibelGain'] !== 10 ||
            references?.['dm.core.hpStepDecibels'] !== 0.01 ||
            references?.['dm.m4.decibelGain'] !== 0.1
          )
            errors.push('resource_grant_parameter_source_unbound')
          if (
            !Number.isFinite(trigger.hpLossPercent) ||
            trigger.hpLossPercent! < 0 ||
            trigger.hpLossPercent! > 100 ||
            !Number.isInteger(provider?.mindscape) ||
            provider.mindscape < 0 ||
            provider.mindscape > 6
          )
            errors.push('resource_grant_hp_loss_or_rank_unobserved')
          if (!declarationInvalid && !errors.length)
            value = trigger.hpLossPercent! * 10 * (provider.mindscape >= 4 ? 1.1 : 1)
          grants.push({
            agentId: extended.agentId,
            atSeconds: trigger.atSeconds,
            nominalValue: value,
          })
        } else if (trigger.mechanism === 'yuzuha_ultimate_energy') {
          if (
            reviewedSources.extendedMechanismSources['agent-yuzuha'].calcedParamsFormula !==
            '{CAL:7+chainLevel*1.5,1,2}'
          )
            errors.push('resource_grant_parameter_source_unbound')
          const level = provider?.skillLevels.chain
          if (!Number.isInteger(level) || level < 1 || level > 16)
            errors.push('resource_grant_chain_level_unobserved')
          // The pinned calcedParams uses the same zero-based chainLevel as
          // current source event operators; account levels are already effective.
          if (!declarationInvalid && !errors.length) value = 7 + (level - 1) * 1.5
          for (const agentId of memberIds.filter((id) => id !== extended.agentId))
            grants.push({ agentId, atSeconds: trigger.atSeconds, nominalValue: value })
        } else {
          if (references?.['dm.m1.energy'] !== 30)
            errors.push('resource_grant_parameter_source_unbound')
          if (
            !Number.isInteger(provider?.mindscape) ||
            provider.mindscape < 0 ||
            provider.mindscape > 6
          )
            errors.push('resource_grant_rank_unobserved')
          active = provider?.mindscape >= 1
          const key = trigger.providerAgentId + ':' + trigger.mechanism
          if (!last.has(key)) {
            const prior = declaration?.lastTriggerAtSeconds[key]
            if (
              prior === null ||
              (typeof prior === 'number' && Number.isFinite(prior) && prior <= 0)
            )
              last.set(key, prior)
            else if (active) errors.push('resource_grant_initial_cooldown_unknown')
          }
          const ready =
            last.has(key) && (last.get(key) === null || trigger.atSeconds - last.get(key)! >= 180)
          if (!declarationInvalid && !errors.length) value = active && ready ? 30 : 0
          if (value !== null && value > 0) last.set(key, trigger.atSeconds)
          grants.push({
            agentId: extended.agentId,
            atSeconds: trigger.atSeconds,
            nominalValue: value,
          })
        }
        state =
          declarationInvalid || errors.length
            ? 'unknown'
            : !grants.length
              ? 'inactive'
              : value && value > 0
                ? 'granted'
                : active === false
                  ? 'inactive'
                  : trigger.mechanism === 'yuzuha_m1_investigation_entry_energy'
                    ? 'cooldown'
                    : 'granted'
      } else if (support) {
        const recipients = memberIds.filter((id) => id !== trigger.providerAgentId)
        const next = trigger.nextSwitchIn
        if (
          next &&
          (!recipients.includes(next.agentId) ||
            !Number.isFinite(next.atSeconds) ||
            next.atSeconds < trigger.atSeconds ||
            next.atSeconds >= (declaration?.durationSeconds ?? 0))
        )
          errors.push('invalid_support_ultimate_next_switch')
        const invalid = declarationInvalid || errors.length > 0
        for (const agentId of recipients)
          grants.push({
            agentId,
            atSeconds: trigger.atSeconds,
            nominalValue: invalid ? null : support.otherMemberEnergy,
          })
        const reusedSwitch = next && (switchUseCounts.get(switchKey(next)) ?? 0) > 1
        if (reusedSwitch) errors.push('support_ultimate_shared_next_switch_unresolved')
        if (next)
          grants.push({
            agentId: next.agentId,
            atSeconds: next.atSeconds,
            nominalValue: invalid || reusedSwitch ? null : support.nextIncomingEnergy,
          })
        else if (next === undefined && recipients.length) {
          errors.push('support_ultimate_next_switch_unobserved')
          for (const agentId of recipients)
            grants.push({ agentId, atSeconds: null, nominalValue: null })
        }
        state =
          declarationInvalid || errors.length ? 'unknown' : grants.length ? 'granted' : 'inactive'
      }
      issues.push(...errors)
      const nominalValue =
        declarationInvalid || errors.length || grants.some((row) => row.nominalValue === null)
          ? null
          : grants.reduce((sum, row) => sum + row.nominalValue!, 0)
      const source = spec
        ? reviewedSources.mechanismSources[spec.agentId]
        : extended
          ? reviewedSources.extendedMechanismSources[extended.agentId]
          : support?.source
      return {
        ...trigger,
        grants,
        recipientAgentIds: [...new Set(grants.map((row) => row.agentId))],
        unit: spec?.unit ?? extended?.unit ?? (support ? ('energy_points' as const) : null),
        nominalValue,
        receivedValue: null,
        state,
        ...(support && trigger.nextSwitchIn === null
          ? { pendingNextIncomingEnergyPoints: support.nextIncomingEnergy }
          : {}),
        sourceRefs: [
          ...trigger.sourceRefs,
          ...(source ? [source.path + '#' + source.sha256 + '#' + source.locator] : []),
          ...(spec && contract?.source.profileHash
            ? [
                contract.source.packageId + ':' + contract.source.profileId,
                'profile-hash:' + contract.source.profileHash,
                contract.resourceFlow.evidenceLocator,
              ]
            : []),
        ],
        blockers: errors,
      }
    })
  const structuralInvalid = issues.some((issue) => issue.startsWith('invalid_'))
  const totals = input.members.map(({ agentId }) => {
    const sum = (unit: 'energy_points' | 'decibel_points') => {
      const selected = rows
        .filter((row) => row.unit === unit)
        .flatMap((row) => row.grants.filter((grant) => grant.agentId === agentId))
      return declarationInvalid ||
        structuralInvalid ||
        selected.some((row) => row.nominalValue === null)
        ? null
        : selected.reduce((total, row) => total + row.nominalValue!, 0)
    }
    return {
      agentId,
      nominalEnergyPoints: sum('energy_points'),
      nominalDecibelPoints: sum('decibel_points'),
    }
  })
  const core = {
    status: issues.length ? ('unknown' as const) : ('supported' as const),
    rows,
    totals,
    blockers: [...new Set(issues)],
    declaration: declaration ?? null,
    coveredMechanisms: [
      ...Object.keys(specifications),
      ...Object.keys(extendedSpecifications),
      'reviewed_support_ultimate_energy',
    ],
    sourceIdentity: sourceMechanismResourceGrantIdentity32,
    boundary:
      'Listed explicit mechanism triggers only. Missing trigger/history/receiver is unknown; nominal grants are separate from actual receipt, unconverted hit fields, overflow and a full cycle.',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
