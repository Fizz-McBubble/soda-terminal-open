import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import { reduceObservedPlanningEffect32 } from './planningKnownInactiveEffects32'
import { requiredReferences } from './currentPlanningEffectExpressions'
import type { UpstreamExpressionIR } from './currentUpstreamExpressionIR'

/** DM is source data; combat selections require an explicit observation. A source
 * sheet's neutral UI defaults are not evidence that a live condition is off. */
export function planningEffectObservation32(input: {
  entry: CurrentAgentPlanningEffectBlueprint
  expression: UpstreamExpressionIR
  member: PlanningEffectRuntimeMember
  memberIds: readonly string[]
  references: Readonly<Record<string, unknown>>
}) {
  const reduced = reduceObservedPlanningEffect32(
    input.entry,
    input.member,
    input.references,
    input.memberIds,
  )
  const expression = reduced?.expression ?? input.expression
  const required = requiredReferences(expression).filter(
    (ref) =>
      !/^(dm\.|char\.|own\.(initial|final|char)\.|target\.(initial|final|char)\.|team\.common\.count)/.test(
        ref,
      ),
  )
  const missing = required.filter((ref) => !Object.hasOwn(input.references, ref))
  const operators = new Set<string>()
  const visit = (node: UpstreamExpressionIR) => {
    if (node.kind === 'call') {
      operators.add(node.operator)
      if (node.receiver) visit(node.receiver)
      node.arguments.forEach(visit)
    } else if (node.kind === 'array') node.items.forEach(visit)
    else if (node.kind === 'object') node.entries.forEach((entry) => visit(entry.value))
    else if (node.kind === 'property') visit(node.receiver)
    else if (node.kind === 'element') {
      visit(node.receiver)
      visit(node.index)
    }
  }
  visit(expression)
  for (const [operator, reference] of [
    ['directStrikeCheck', 'directStrike'],
    ['besiege', 'besiege'],
    ['besiegeDisplay', 'besiegeDisplay'],
  ])
    if (operators.has(operator!) && !Object.hasOwn(input.references, reference!))
      missing.push(reference!)
  const inactive = reduced?.inactive ?? false
  return { expression, inactive, missing: inactive ? [] : [...new Set(missing)] }
}
