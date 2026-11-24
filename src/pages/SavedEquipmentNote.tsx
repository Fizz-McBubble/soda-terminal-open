import type { SavedLuminizeReplay32 } from '../application/savedLuminizeReplay32'

export function SavedEquipmentNote({
  note,
  settlement,
}: {
  note?: string
  settlement?: SavedLuminizeReplay32
}) {
  const text = note?.trim()
  const result =
    settlement?.status === 'declared_arithmetic'
      ? `单次辉映 ${settlement.totalDamage!.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（非暴击，按已保存条件结算）`
      : settlement?.status === 'stale'
        ? '辉映结算依据已变化，历史快照仍保留。'
        : undefined
  if (!text && !result) return null
  return (
    <p
      className="team-execution__evidence"
      role={result ? 'status' : undefined}
      title={settlement?.boundary}
    >
      {text ? `保存时的配装说明：${text}` : ''}
      {text && result ? '；' : ''}
      {result}
    </p>
  )
}
