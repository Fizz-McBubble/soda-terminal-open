/** Keep actionable messages; implementation details belong to diagnostics, not player alerts. */
export function playerErrorMessage(error: unknown, fallback: string) {
  const message = (
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  ).trim()
  const internal =
    /\b(?:contract|schema|stack|TypeError|ReferenceError|IndexedDB|fnv1a|sha256)\b|(?:agent|set|wengine|bangboo)-[a-z0-9-]+|候选约束|生产数据|同源校验|请求结构|数据契约|[A-Z]:[\\/]|https?:\/\//i
  return message.length <= 240 && /[\u3400-\u9fff]/.test(message) && !internal.test(message)
    ? message
    : fallback
}
