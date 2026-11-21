export function flattenFields(value, prefix = '') {
  if (Array.isArray(value) && value.length)
    return value.flatMap((v, i) => flattenFields(v, `${prefix}[${i}]`))
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length
  )
    return Object.entries(value).flatMap(([k, v]) =>
      flattenFields(v, prefix ? `${prefix}.${k}` : k),
    )
  return [{ fieldPath: prefix || '$', value }]
}
