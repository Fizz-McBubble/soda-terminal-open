export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function frozenRecoveryBatchIdLabel(input: unknown) {
  const value = input as { batch?: { id?: unknown } } | null | undefined
  return typeof value?.batch?.id === 'string' ? value.batch.id : '未知批次'
}

export function reviewedRecoveryBatchIdLabel(input: unknown) {
  const value = input as { batch?: { id?: unknown } } | null | undefined
  return typeof value?.batch?.id === 'string' ? value.batch.id : '未知批次'
}
