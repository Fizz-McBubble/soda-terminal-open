import admission from '../gameDataPacks/generated/default-team-admission.3.3.json'
import { getCurrentAgentNumericContract } from '../calculation/currentAgentNumericContracts'
import { projectBangbooUtility } from '../calculation/currentBangbooUtilityProjection'
import {
  resolveTargetTeamBangbooOption,
  sampleLeaders,
  targetTeamBangbooOptions,
} from './targetTeamSourceBangbooOptions'

const admitted = new Set(admission.rows.map((row) => row[0] as string))

export function isAdmittedBoxTeam(memberIds: readonly string[]) {
  return admitted.has([...memberIds].sort().join('|'))
}

/** The extra ability is a separate condition from delivery of the active skill. */
export function admittedTeamBangbooOptions(input: Parameters<typeof targetTeamBangbooOptions>[0]) {
  const choices = targetTeamBangbooOptions(input)
  if (choices.length < 2 || !isAdmittedBoxTeam(input.memberIds)) return choices
  const leaders = sampleLeaders(input.memberIds)
  const third = choices[2]
  if (
    third &&
    (leaders.includes(third.bangbooId) || third.recommendationReason.startsWith('资料推荐'))
  )
    return choices
  const baseCandidates = leaders.filter((id) => id === 'bangboo-snap' || id === 'bangboo-butler')
  if (!third && !baseCandidates.includes('bangboo-butler')) baseCandidates.push('bangboo-butler')
  for (const id of baseCandidates) {
    if (choices.some((row) => row.bangbooId === id)) continue
    const choice = resolveTargetTeamBangbooOption(input, id)
    if (!choice || choice.activationStatus !== 'inactive' || choice.recipientFit !== 'base_only')
      continue
    if (!hasUsableBaseSkill(input.memberIds, id, choice.defaultStars)) continue
    return [
      ...choices.slice(0, 2),
      {
        ...choice,
        recommendationReason:
          (leaders.includes(id) ? '同队实战；' : '') + choice.recommendationReason,
      },
    ]
  }
  return choices
}

function hasUsableBaseSkill(memberIds: readonly string[], id: string, stars: number) {
  const receivesEnergy = memberIds.some((id) => {
    const identity = getCurrentAgentNumericContract(id)?.identity
    return identity && identity.specialty !== 'rupture'
  })
  const { baseUtilities } = projectBangbooUtility({
    memberIds,
    bangbooId: id,
    stars,
    activationStatus: 'inactive',
  })
  return baseUtilities.some(
    (effect) =>
      effect.action === 'active' &&
      ((id === 'bangboo-butler' &&
        receivesEnergy &&
        effect.utilityType === 'energy_flat' &&
        effect.unit === 'energy_point') ||
        (id === 'bangboo-snap' &&
          effect.utilityType === 'damage_bonus' &&
          effect.unit === 'damage_ratio' &&
          effect.trigger === 'on_dodge_counter_or_quick_assist_or_assist_follow_up')) &&
      effect.value > 0 &&
      effect.sourceEvidence.url &&
      effect.sourceEvidence.sha256,
  )
}
