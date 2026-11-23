/** Keep actionable messages; implementation details belong to diagnostics, not player alerts. */
export function playerErrorMessage(error: unknown, fallback: string) {
  const message = (
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  ).trim()
  const internalId =
    /(?:agent|set|wengine|bangboo|disc|candidate|source|scenario|loadout|scheme|plan|run|account)-[a-z0-9][a-z0-9_-]*/i
  const internalKeyValue =
    /(?:agent|wengine|bangboo|disc|candidate|source|scenario|loadout|scheme|plan|run|account)(?:id|Id|ID|_id)?\s*[:=#]\s*[a-z0-9][a-z0-9_-]*/i
  const internalDetail =
    /\b(?:contract|schema|stack|error|exception|TypeError|ReferenceError|RangeError|DOMException|AbortError|NetworkError|QuotaExceededError|IndexedDB|fnv1a|sha256|internal server error|failed to fetch|unexpected token|not found|forbidden|unauthorized)\b|候选约束|生产数据|同源校验|请求结构|数据契约|资产快读合同|内部异常|内部错误|[A-Z]:[\\/]|https?:\/\/|(?:^|\n)\s*at\s+\S+|\bHTTP\s*[45]\d{2}\b|\bstatus\s*[:=]\s*[45]\d{2}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
  const structuredPayload = /^\s*[[{]/.test(message)
  return message.length <= 240 &&
    /[\u3400-\u9fff]/.test(message) &&
    !internalId.test(message) &&
    !internalKeyValue.test(message) &&
    !internalDetail.test(message) &&
    !structuredPayload
    ? message
    : fallback
}
