/** Expression syntax and a writable conditional slot do not prove a game effect. */
export function currentEffectFactAdmission(effect: {
  numericExpression: {
    classification?: string
    todoBoundary?: string | null
    genericConditionalIdentifiers?: readonly string[]
  }
}): 'source_expression' | 'unbound_placeholder' | 'unresolved_condition' {
  const expression = effect.numericExpression
  if (
    expression.classification === 'declarative_baseline_input' ||
    expression.genericConditionalIdentifiers?.length
  )
    return 'unbound_placeholder'
  if (expression.todoBoundary) return 'unresolved_condition'
  return expression.classification === 'upstream_expression_available'
    ? 'source_expression'
    : 'unresolved_condition'
}
