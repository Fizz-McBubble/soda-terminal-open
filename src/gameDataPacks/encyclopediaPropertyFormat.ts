import { evaluateBangbooSourcePropertyFormula } from '../calculation/currentBangbooSourceFormula'

const numericText = (value: number, precision = 2) => String(Number(value.toFixed(precision)))

function arithmetic(expression: string): number {
  // Reuse the existing restricted arithmetic parser; source text is never code.
  const normalized = expression.replace(/(^|\()\s*-/g, (_, prefix: string) => `${prefix}0-`)
  const value = evaluateBangbooSourcePropertyFormula(normalized, () => null)
  if (value === null) throw Error(`Unsupported encyclopedia arithmetic: ${expression}`)
  return value
}

/** The single catalog selector previews every skill at the same chosen level.
 * CAL's scale converts its source value to the explicit unit outside the token. */
export function formatEncyclopediaCalculatedText(text: string, level?: number): string {
  const controls = text.replace(
    /\{LAYOUT_CONSOLECONTROLLER#[^}]+}\{LAYOUT_FALLBACK#([^}]+)}/g,
    '$1',
  )
  const result = controls.replace(
    /\{CAL:([^{}]+),\s*(\d+),\s*(\d+)\}/g,
    (_, expression: string, scale: string, precision: string) => {
      const digits = Number(precision)
      if (digits > 6) throw Error(`Unsupported encyclopedia precision: ${precision}`)
      if (expression.includes('AvatarSkillLevel(') && !Number.isInteger(level))
        throw Error(`Missing encyclopedia skill level: ${text}`)
      const substituted = expression.replace(/AvatarSkillLevel\(\d+\)/g, String(level))
      return numericText(arithmetic(substituted) * Number(scale), digits)
    },
  )
  if (/\{CAL:|AvatarSkillLevel\(|\{LAYOUT_/.test(result))
    throw Error(`Unresolved encyclopedia level expression: ${text}`)
  return result
}

/** Evaluate only source-braced groups. Outside additions and hit counts stay
 * visible, so a per-hit rate cannot silently become a guaranteed total hit. */
export function formatEncyclopediaProperty(
  template: string,
  level: number,
  resolve: (skillId: string, propertyKey: string) => { value: number; format: string },
): string {
  let text = formatEncyclopediaCalculatedText(template, level).replace(
    /\{Skill:(\d+),\s*Prop:(\d+)\}/g,
    (_, skillId: string, propertyKey: string) => {
      const result = resolve(skillId, propertyKey)
      if (!Number.isFinite(result.value) || result.format !== '%')
        throw Error(`Unsupported encyclopedia property: ${skillId}/${propertyKey}`)
      return `${numericText(result.value, 6)}%`
    },
  )
  while (/\{[^{}]+\}/.test(text)) {
    text = text.replace(/\{([^{}]+)\}/g, (_, expression: string) => {
      const percent = expression.includes('%')
      return `${numericText(arithmetic(expression.replaceAll('%', '')))}${percent ? '%' : ''}`
    })
  }
  if (/[{}]|\bNaN\b|\bundefined\b/.test(text))
    throw Error(`Unresolved encyclopedia property: ${template}`)
  return text
    .replace(/\s*\*\s*/g, ' × ')
    .replace(/(?<=[\d%)\]])\s*\/\s*(?=\d)/g, ' ÷ ')
    .replace(/\s*\+\s*/g, ' + ')
}
