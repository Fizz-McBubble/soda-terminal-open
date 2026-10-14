import {
  evaluateUpstreamExpressionIr,
  type UpstreamExpressionIR,
} from '../calculation/currentUpstreamExpressionIR'

export type EffectReceiver = { path: string; damageType: string | null }

export function baseReferenceExpression(
  expression: UpstreamExpressionIR,
  references: Readonly<Record<string, unknown>> = {},
  ability = false,
): UpstreamExpressionIR {
  if (expression.kind === 'reference')
    return Object.hasOwn(references, expression.path)
      ? { kind: 'literal', value: references[expression.path] }
      : expression
  if (expression.kind === 'call') {
    const args = expression.arguments.map((arg) =>
      baseReferenceExpression(arg, references, ability),
    )
    const receiver =
      expression.receiver && baseReferenceExpression(expression.receiver, references, ability)
    if (['abilityCheck', 'ability_check'].includes(expression.operator))
      return args[ability ? 0 : 1] ?? { kind: 'literal', value: 0 }
    if (['cmpGE', 'cmpGT', 'cmpLT', 'cmpEq', 'cmpNE'].includes(expression.operator)) {
      const predicate = evaluateUpstreamExpressionIr(
        {
          ...expression,
          receiver,
          arguments: [
            ...args.slice(0, 2),
            { kind: 'literal', value: true },
            { kind: 'literal', value: false },
          ],
        },
        { references: {} },
      )
      if (predicate.status === 'supported' && typeof predicate.value === 'boolean')
        return args[predicate.value ? 2 : 3] ?? { kind: 'literal', value: 0 }
    }
    if (
      ['prod', 'binary:*'].includes(expression.operator) &&
      args.some((arg) => arg.kind === 'literal' && arg.value === 0)
    )
      return { kind: 'literal', value: 0 }
    const result: UpstreamExpressionIR = { ...expression, receiver, arguments: args }
    if (['add', 'addWithDmgType'].includes(expression.operator)) {
      const value = args.at(-1)
      if (value?.kind === 'literal' && value.value === 0) return { kind: 'literal', value: 0 }
    }
    const evaluated = evaluateUpstreamExpressionIr(result, { references: {} })
    return evaluated.status === 'supported' ? { kind: 'literal', value: evaluated.value } : result
  }
  if (expression.kind === 'property')
    return {
      ...expression,
      receiver: baseReferenceExpression(expression.receiver, references, ability),
    }
  if (expression.kind === 'element')
    return {
      ...expression,
      receiver: baseReferenceExpression(expression.receiver, references, ability),
      index: baseReferenceExpression(expression.index, references, ability),
    }
  if (expression.kind === 'array')
    return {
      ...expression,
      items: expression.items.map((item) => baseReferenceExpression(item, references, ability)),
    }
  if (expression.kind === 'object')
    return {
      ...expression,
      entries: expression.entries.map((entry) => ({
        ...entry,
        value: baseReferenceExpression(entry.value, references, ability),
      })),
    }
  return expression
}

export function baseEffectReceivers(
  expression: UpstreamExpressionIR,
  references: Readonly<Record<string, unknown>> = {},
  ability = false,
): EffectReceiver[] {
  return effectReceivers(baseReferenceExpression(expression, references, ability))
}

export function expressionReferences(expression: UpstreamExpressionIR): string[] {
  if (expression.kind === 'reference') return [expression.path]
  if (expression.kind === 'call')
    return [
      ...expression.arguments.flatMap(expressionReferences),
      ...(expression.receiver ? expressionReferences(expression.receiver) : []),
    ]
  if (expression.kind === 'property') return expressionReferences(expression.receiver)
  if (expression.kind === 'element')
    return [...expressionReferences(expression.receiver), ...expressionReferences(expression.index)]
  if (expression.kind === 'array') return expression.items.flatMap(expressionReferences)
  if (expression.kind === 'object')
    return expression.entries.flatMap((entry) => expressionReferences(entry.value))
  return []
}

export function hasConditionalGate(expression: UpstreamExpressionIR): boolean {
  if (expression.kind === 'call')
    return (
      ['ifOn', 'cmpGE', 'cmpGT', 'cmpLT', 'cmpEq', 'cmpNE'].includes(expression.operator) ||
      expression.arguments.some(hasConditionalGate) ||
      Boolean(expression.receiver && hasConditionalGate(expression.receiver))
    )
  if (expression.kind === 'property') return hasConditionalGate(expression.receiver)
  if (expression.kind === 'element')
    return hasConditionalGate(expression.receiver) || hasConditionalGate(expression.index)
  if (expression.kind === 'array') return expression.items.some(hasConditionalGate)
  if (expression.kind === 'object')
    return expression.entries.some((entry) => hasConditionalGate(entry.value))
  return false
}

export function effectReceivers(expression: UpstreamExpressionIR): EffectReceiver[] {
  if (expression.kind === 'call') {
    const own =
      ['add', 'addWithDmgType'].includes(expression.operator) &&
      expression.receiver?.kind === 'reference'
        ? [
            {
              path: expression.receiver.path,
              damageType:
                expression.operator === 'addWithDmgType' &&
                expression.arguments[0]?.kind === 'literal' &&
                typeof expression.arguments[0].value === 'string'
                  ? expression.arguments[0].value
                  : null,
            },
          ]
        : []
    return [
      ...own,
      ...expression.arguments.flatMap(effectReceivers),
      ...(expression.receiver ? effectReceivers(expression.receiver) : []),
    ]
  }
  if (expression.kind === 'property') return effectReceivers(expression.receiver)
  if (expression.kind === 'element')
    return [...effectReceivers(expression.receiver), ...effectReceivers(expression.index)]
  if (expression.kind === 'array') return expression.items.flatMap(effectReceivers)
  if (expression.kind === 'object')
    return expression.entries.flatMap((entry) => effectReceivers(entry.value))
  return []
}
