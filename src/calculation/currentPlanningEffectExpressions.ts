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

type PlanningSkillLevelSource = {
  skillLevels: Readonly<Record<string, number>>
}

const combatSkillReference = /^(?:own\.)?char\.(basic|dodge|assist|special|chain)$/

/**
 * Source expressions use combat skill references as effective levels and core
 * skill references as zero-based table indices. Preserve subscript inputs as
 * indices, while binding direct level expressions to the account's effective
 * value instead of the generic table offset.
 */
export function bindPlanningSkillLevelValueReferences32(input: {
  expression: UpstreamExpressionIR
  provider: PlanningSkillLevelSource
}): UpstreamExpressionIR {
  const bind = (node: UpstreamExpressionIR, subscriptIndex: boolean): UpstreamExpressionIR => {
    if (node.kind === 'reference' && !subscriptIndex) {
      const skill = node.path.match(combatSkillReference)?.[1]
      const level = skill ? input.provider.skillLevels[skill] : undefined
      if (Number.isInteger(level) && Number(level) > 0) {
        return { kind: 'literal', value: level }
      }
    }
    if (node.kind === 'call') {
      return {
        ...node,
        ...(node.receiver === undefined ? {} : { receiver: bind(node.receiver, false) }),
        arguments: node.arguments.map((argument, index) =>
          bind(argument, node.operator === 'subscript' && index === 0),
        ),
      }
    }
    if (node.kind === 'property') return { ...node, receiver: bind(node.receiver, false) }
    if (node.kind === 'element') {
      return {
        ...node,
        receiver: bind(node.receiver, false),
        index: bind(node.index, false),
      }
    }
    if (node.kind === 'array')
      return { ...node, items: node.items.map((item) => bind(item, false)) }
    if (node.kind === 'object')
      return {
        ...node,
        entries: node.entries.map((entry) => ({
          ...entry,
          value: bind(entry.value, false),
        })),
      }
    return node
  }
  return bind(input.expression, false)
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
