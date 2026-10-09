/** No game defaults: callers must resolve versioned source inputs first. */
export function finite(value: number, name: string, minimum = -Infinity): number {
  if (!Number.isFinite(value) || value < minimum) throw new Error(`invalid_${name}`)
  return value
}
export function integer(value: number, name: string, minimum: number, maximum: number): number {
  finite(value, name, minimum)
  if (!Number.isInteger(value) || value > maximum) throw new Error(`invalid_${name}`)
  return value
}
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value)
  if (typeof value === 'number') {
    finite(value, 'fingerprint_number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`
  throw new Error('non_serializable_fingerprint_input')
}
