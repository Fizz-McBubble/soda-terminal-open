export type UpstreamExpressionIR =
  | { kind: 'literal'; value: unknown }
  | { kind: 'reference'; path: string }
  | { kind: 'property'; receiver: UpstreamExpressionIR; property: string }
  | { kind: 'element'; receiver: UpstreamExpressionIR; index: UpstreamExpressionIR }
  | {
      kind: 'call'
      operator: string
      receiver?: UpstreamExpressionIR
      arguments: UpstreamExpressionIR[]
    }
  | { kind: 'object'; entries: Array<{ key: string; value: UpstreamExpressionIR }> }
  | { kind: 'array'; items: UpstreamExpressionIR[] }
  | { kind: 'unsupported'; syntaxKind: string }

export type UpstreamExpressionRuntime = {
  references: Readonly<Record<string, unknown>>
  operators?: Readonly<
    Record<string, (input: { receiver: unknown; arguments: unknown[] }) => unknown>
  >
}

export type PlanningExpressionDomainRuntimeInput = {
  references: Readonly<Record<string, unknown>>
  teamCounts?: {
    specialty?: Readonly<Record<string, number>>
    faction?: Readonly<Record<string, number>>
  }
  gates?: {
    ability?: boolean
    directStrike?: boolean
    besiege?: boolean
    besiegeDisplay?: boolean
  }
}

type EvaluationResult =
  | { status: 'supported'; value: unknown }
  | { status: 'unsupported'; blockers: string[] }

const supported = (value: unknown): EvaluationResult => ({ status: 'supported', value })
const unsupported = (...blockers: string[]): EvaluationResult => ({
  status: 'unsupported',
  blockers: [...new Set(blockers)],
})

function numericArguments(values: unknown[]) {
  return values.every((value) => typeof value === 'number' && Number.isFinite(value))
    ? (values as number[])
    : null
}

function evaluateBuiltin(operator: string, values: unknown[]): EvaluationResult | null {
  const numbers = numericArguments(values)
  if (operator === 'constant' || operator === 'percent') return supported(values[0])
  if (operator === 'negate')
    return numbers?.length === 1 ? supported(-numbers[0]) : unsupported(`${operator} 参数无效。`)
  if (operator === 'sum')
    return numbers
      ? supported(numbers.reduce((sum, value) => sum + value, 0))
      : unsupported('sum 参数无效。')
  if (operator === 'prod')
    return numbers
      ? supported(numbers.reduce((product, value) => product * value, 1))
      : unsupported('prod 参数无效。')
  if (operator === 'min' || operator === 'max')
    return numbers?.length
      ? supported(operator === 'min' ? Math.min(...numbers) : Math.max(...numbers))
      : unsupported(`${operator} 参数无效。`)
  if (operator.startsWith('binary:')) {
    if (!numbers || numbers.length !== 2) return unsupported(`${operator} 参数无效。`)
    const [left, right] = numbers
    if (operator === 'binary:+') return supported(left + right)
    if (operator === 'binary:-') return supported(left - right)
    if (operator === 'binary:*') return supported(left * right)
    if (operator === 'binary:/')
      return right === 0 ? unsupported('binary:/ 除数不能为 0。') : supported(left / right)
  }
  if (['cmpGE', 'cmpGT', 'cmpLT', 'cmpEq'].includes(operator)) {
    if (values.length < 3 || typeof values[0] !== 'number' || typeof values[1] !== 'number')
      return unsupported(`${operator} 参数无效。`)
    const [left, right, whenTrue, whenFalse = 0] = values
    const matches =
      operator === 'cmpGE'
        ? left >= right
        : operator === 'cmpGT'
          ? left > right
          : operator === 'cmpLT'
            ? left < right
            : left === right
    return supported(matches ? whenTrue : whenFalse)
  }
  if (operator === 'subscript') {
    const [index, table] = values
    if (!Number.isInteger(index) || !Array.isArray(table))
      return unsupported('subscript 参数无效。')
    const value = table[index as number]
    return value === undefined ? unsupported(`subscript 索引越界：${index}`) : supported(value)
  }
  return null
}

export const currentUpstreamExpressionBuiltinOperators = Object.freeze([
  'constant',
  'percent',
  'negate',
  'sum',
  'prod',
  'min',
  'max',
  'binary:+',
  'binary:-',
  'binary:*',
  'binary:/',
  'cmpGE',
  'cmpGT',
  'cmpLT',
  'cmpEq',
  'subscript',
] as const)

export const currentPlanningExpressionDomainOperators = Object.freeze([
  'ifOn',
  'ifOff',
  'map',
  'withSpecialty',
  'withFaction',
  'ability_check',
  'abilityCheck',
  'directStrikeCheck',
  'besiege',
  'besiegeDisplay',
] as const)

function conditionalValue(enabled: boolean, values: unknown[]) {
  return enabled ? values[0] : (values[1] ?? 0)
}

function numericCount(group: Readonly<Record<string, number>> | undefined, key: unknown) {
  return typeof key === 'string' ? (group?.[key] ?? 0) : 0
}

export function createPlanningExpressionDomainRuntime(
  input: PlanningExpressionDomainRuntimeInput,
): UpstreamExpressionRuntime {
  const gate = (key: keyof NonNullable<PlanningExpressionDomainRuntimeInput['gates']>) =>
    input.gates?.[key] === true
  return {
    references: input.references,
    operators: {
      ifOn: ({ receiver, arguments: values }) => conditionalValue(Boolean(receiver), values),
      ifOff: ({ receiver, arguments: values }) => conditionalValue(!receiver, values),
      map: ({ receiver, arguments: values }) => {
        const mapping = values[0]
        if (mapping === null || typeof mapping !== 'object') return 0
        return (mapping as Record<string, unknown>)[String(receiver)] ?? 0
      },
      withSpecialty: ({ arguments: values }) =>
        numericCount(input.teamCounts?.specialty, values[0]),
      withFaction: ({ arguments: values }) => numericCount(input.teamCounts?.faction, values[0]),
      ability_check: ({ arguments: values }) => conditionalValue(gate('ability'), values),
      abilityCheck: ({ arguments: values }) => conditionalValue(gate('ability'), values),
      directStrikeCheck: ({ arguments: values }) => conditionalValue(gate('directStrike'), values),
      besiege: ({ arguments: values }) => conditionalValue(gate('besiege'), values),
      besiegeDisplay: ({ arguments: values }) => conditionalValue(gate('besiegeDisplay'), values),
    },
  }
}

export function extractUpstreamEffectValueIr(root: UpstreamExpressionIR): EvaluationResult {
  if (root.kind !== 'call' || !['add', 'addWithDmgType'].includes(root.operator))
    return unsupported('效果表达式根节点不是 add/addWithDmgType。')
  const value = root.arguments.at(-1)
  return value ? supported(value) : unsupported('效果表达式缺少数值参数。')
}

export function evaluateUpstreamExpressionIr(
  expression: UpstreamExpressionIR,
  runtime: UpstreamExpressionRuntime,
): EvaluationResult {
  if (expression.kind === 'unsupported')
    return unsupported(`表达式 IR 不支持语法：${expression.syntaxKind}`)
  if (expression.kind === 'literal') return supported(expression.value)
  if (expression.kind === 'reference')
    return Object.hasOwn(runtime.references, expression.path)
      ? supported(runtime.references[expression.path])
      : unsupported(`缺少表达式引用：${expression.path}`)
  if (expression.kind === 'array') {
    const values = expression.items.map((item) => evaluateUpstreamExpressionIr(item, runtime))
    const blockers = values.flatMap((result) =>
      result.status === 'unsupported' ? result.blockers : [],
    )
    return blockers.length
      ? unsupported(...blockers)
      : supported(values.map((result) => (result.status === 'supported' ? result.value : null)))
  }
  if (expression.kind === 'object') {
    const entries = expression.entries.map((entry) => ({
      key: entry.key,
      result: evaluateUpstreamExpressionIr(entry.value, runtime),
    }))
    const blockers = entries.flatMap(({ result }) =>
      result.status === 'unsupported' ? result.blockers : [],
    )
    return blockers.length
      ? unsupported(...blockers)
      : supported(
          Object.fromEntries(
            entries.map(({ key, result }) => [
              key,
              result.status === 'supported' ? result.value : null,
            ]),
          ),
        )
  }
  if (expression.kind === 'property') {
    const receiver = evaluateUpstreamExpressionIr(expression.receiver, runtime)
    if (receiver.status === 'unsupported') return receiver
    if (receiver.value === null || typeof receiver.value !== 'object')
      return unsupported(`无法读取属性：${expression.property}`)
    return supported((receiver.value as Record<string, unknown>)[expression.property])
  }
  if (expression.kind === 'element') {
    const receiver = evaluateUpstreamExpressionIr(expression.receiver, runtime)
    if (receiver.status === 'unsupported') return receiver
    const index = evaluateUpstreamExpressionIr(expression.index, runtime)
    if (index.status === 'unsupported') return index
    if (receiver.value === null || typeof receiver.value !== 'object')
      return unsupported('element receiver 无效。')
    return supported((receiver.value as Record<PropertyKey, unknown>)[index.value as PropertyKey])
  }

  const args = expression.arguments.map((argument) =>
    evaluateUpstreamExpressionIr(argument, runtime),
  )
  const blockers = args.flatMap((result) =>
    result.status === 'unsupported' ? result.blockers : [],
  )
  if (blockers.length) return unsupported(...blockers)
  const receiverValue = expression.receiver
    ? evaluateUpstreamExpressionIr(expression.receiver, runtime)
    : supported(undefined)
  if (receiverValue.status === 'unsupported') return receiverValue
  const values = args.map((result) => (result.status === 'supported' ? result.value : null))
  const builtin = evaluateBuiltin(expression.operator, values)
  if (builtin) return builtin
  const custom = runtime.operators?.[expression.operator]
  return custom
    ? supported(custom({ receiver: receiverValue.value, arguments: values }))
    : unsupported(`缺少表达式 operator runtime：${expression.operator}`)
}

export const currentUpstreamExpressionOperatorContract = Object.freeze({
  contract: 'soda-upstream-expression-ir/v1',
  structuralSourceExpressionCount: 342,
  directUpstreamExpressionCount: 303,
  declarativeBaselineInputExpressionCount: 39,
  sharedIrReadyCount: 342,
  sharedIrPendingCount: 0,
  builtinOperatorCount: currentUpstreamExpressionBuiltinOperators.length,
  domainOperatorCount: currentPlanningExpressionDomainOperators.length,
  dedicatedAdapterCount: 0,
  productionRuntimeReadyCount: 0,
  boundary:
    'The shared evaluator implements arithmetic/table/threshold primitives plus shared conditional, team-count and capability gates. Generic conditionals are declarative PlanningBaseline inputs, not entity adapters. Missing references still fail closed; structural IR readiness does not imply activation, duration, account state or production runtime readiness.',
})
