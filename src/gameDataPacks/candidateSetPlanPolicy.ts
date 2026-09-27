import type { CandidateSetPlan } from './candidateSetPlans'

export { candidateSetPlanPolicyVersion } from '../application/publicBuildIntentFingerprint'

/** Display order is provenance, not an efficacy measurement. Unranked branches are peers. */
export function candidateSetPlanPriority(plan: CandidateSetPlan): number {
  return Number.isFinite(plan.priority) ? plan.priority! : 0
}

export function candidateSetPlanIdentity(plan: CandidateSetPlan): string {
  const rule = plan.condition?.rule
  const ruleIdentity = !rule
    ? ''
    : rule.kind === 'teammate'
      ? `${rule.kind}:${rule.agentId}`
      : rule.kind === 'teammate_four_piece' || rule.kind === 'teammate_not_four_piece'
        ? `${rule.kind}:${rule.setId}`
        : rule.kind
  return [
    plan.pattern,
    [...plan.primarySetIds].sort().join(','),
    [...plan.secondarySetIds].sort().join(','),
    plan.sourceText ?? '',
    plan.purpose ?? '',
    plan.condition?.sourceId ?? '',
    plan.condition?.sourceUrl ?? '',
    plan.condition ? String(plan.condition.sourceTextVerified) : '',
    ruleIdentity,
  ].join('|')
}

export function orderedCandidateSetPlans(plans: readonly CandidateSetPlan[]): CandidateSetPlan[] {
  return [...plans].sort(
    (a, b) =>
      candidateSetPlanPriority(a) - candidateSetPlanPriority(b) ||
      candidateSetPlanIdentity(a).localeCompare(candidateSetPlanIdentity(b)),
  )
}
