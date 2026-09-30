import { useState } from 'react'
import type { RecoveryReviewGroup } from '../accounts/reviewRecovery'
import type { DriveDiscSet } from '../domain/schemas'
export function AccountRecoveryGroupReview({
  group,
  sets,
  onConfirm,
}: {
  group: RecoveryReviewGroup
  sets: DriveDiscSet[]
  onConfirm: (setId: string) => Promise<void>
}) {
  const [setId, setSetId] = useState(group.candidateSetId)
  const [saving, setSaving] = useState(false)
  return (
    <article className="preflight-card">
      <img
        alt={`${group.candidateSetName} 代表盘面`}
        height="126"
        src={group.representativeDataUrl}
        width="124"
      />
      <p>
        <strong>{group.candidateSetName}</strong> · {group.sequences.length} 张 · 序号{' '}
        {group.sequences.join('、')}
      </p>
      <p className="muted-note">{group.reason}</p>
      <label>
        确认套装
        <select value={setId} onChange={(event) => setSetId(event.target.value)}>
          {sets
            .filter((set) => !set.evidenceOnly)
            .map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
        </select>
      </label>
      <button
        className="button button--secondary"
        disabled={saving}
        type="button"
        onClick={() => {
          setSaving(true)
          void onConfirm(setId).finally(() => setSaving(false))
        }}
      >
        {saving ? '正在确认…' : '确认这一组'}
      </button>
    </article>
  )
}
