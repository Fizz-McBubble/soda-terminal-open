import type { UpstreamExpressionIR } from './currentUpstreamExpressionIR'

const cache = new WeakMap<UpstreamExpressionIR, readonly string[]>()
export function requiredReferences(node: UpstreamExpressionIR): readonly string[] {
  const cached = cache.get(node)
  if (cached) return cached
  const refs = new Set<string>()
  const visit = (value: UpstreamExpressionIR) => {
    if (value.kind === 'reference') refs.add(value.path)
    else if (value.kind === 'call') {
      value.arguments.forEach(visit)
      if (value.receiver) visit(value.receiver)
    } else if (value.kind === 'array') value.items.forEach(visit)
    else if (value.kind === 'object') value.entries.forEach((entry) => visit(entry.value))
    else if (value.kind === 'property') visit(value.receiver)
    else if (value.kind === 'element') {
      visit(value.receiver)
      visit(value.index)
    }
  }
  visit(node)
  const result = [...refs]
  cache.set(node, result)
  return result
}

export function effectReceiverMetadata(expression: UpstreamExpressionIR) {
  if (
    expression.kind !== 'call' ||
    !['add', 'addWithDmgType'].includes(expression.operator) ||
    expression.receiver?.kind !== 'reference'
  )
    return { receiverPath: null, damageType: null }
  const damageType =
    expression.operator === 'addWithDmgType' && expression.arguments[0]?.kind === 'literal'
      ? expression.arguments[0].value
      : null
  return {
    receiverPath: expression.receiver.path,
    damageType: typeof damageType === 'string' ? damageType : null,
  }
}

/** Attribute-qualified source channels stay qualified through event projection. */
export function effectAttributeForReceiver(receiverPath: string | null) {
  return (
    receiverPath?.match(/\.combat\.[^.]+\.(physical|fire|ice|electric|ether|wind)$/)?.[1] ?? null
  )
}
