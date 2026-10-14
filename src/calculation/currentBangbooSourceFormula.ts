/** The catalogue uses arithmetic over {Skill, Prop} references, including
 * multiplicities. Parse the small source grammar without executing source text. */
const formulaResults = new Map<string, number | null>()
export function evaluateBangbooSourcePropertyFormula(
  source: string,
  resolve: (skillId: string, propertyId: string) => number | null,
): number | null {
  let missing = false
  const substituted = source
    .replace(/\{Skill:\s*(\d+),\s*Prop:\s*(\d+)\}/g, (_, skillId: string, propertyId: string) => {
      const value = resolve(skillId, propertyId)
      if (value === null || !Number.isFinite(value)) {
        missing = true
        return '0'
      }
      return `(${value})`
    })
    .replaceAll('{', '(')
    .replaceAll('}', ')')
    .replace(/\s+/g, '')
  if (missing || !/^[\d.()+*/-]+$/.test(substituted)) return null
  // Full substituted expression contains every reference's actual value.
  // A changed source expression or property curve cannot reuse a stale result.
  const cached = formulaResults.get(substituted)
  if (cached !== undefined || formulaResults.has(substituted)) return cached ?? null
  const tokens = substituted.match(/\d+(?:\.\d+)?|[()+*/-]/g) ?? []
  if (tokens.join('') !== substituted) return null
  let cursor = 0
  const atom = (): number => {
    const token = tokens[cursor++]
    if (token === '(') {
      const value = sum()
      if (tokens[cursor++] !== ')') return Number.NaN
      return value
    }
    return token && /^\d/.test(token) ? Number(token) : Number.NaN
  }
  const product = (): number => {
    let value = atom()
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const operator = tokens[cursor++]
      const next = atom()
      value = operator === '*' ? value * next : value / next
    }
    return value
  }
  const sum = (): number => {
    let value = product()
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const operator = tokens[cursor++]
      const next = product()
      value = operator === '+' ? value + next : value - next
    }
    return value
  }
  const value = sum()
  const result = cursor === tokens.length && Number.isFinite(value) && value >= 0 ? value : null
  if (formulaResults.size >= 4096) formulaResults.delete(formulaResults.keys().next().value!)
  formulaResults.set(substituted, result)
  return result
}
