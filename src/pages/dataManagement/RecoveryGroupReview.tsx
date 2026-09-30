import { useState } from 'react'
import type { DriveDiscSet } from '../../domain/schemas'
import type { RecoveryGroups } from '../dataManagementPresentation'

export function RecoveryGroupReview({
  group,
  sets,
  onConfirm,
}: {
  group: RecoveryGroups['groups'][number]
  sets: DriveDiscSet[]
  onConfirm: (setId: string) => Promise<void>
}) {
  const [setId, setSetId] = useState(group.candidateSetId)
  const [saving, setSaving] = useState(false)
  return (
    <article className="preflight-card">
      <img
        alt={`${group.candidateSetName} 视觉组代表卡片`}
        src={group.representativeDataUrl}
        width="124"
        height="126"
      />
      <p>
        <strong>{group.groupId}</strong> · 涉及序号 {group.sequences.join('、')}
      </p>
      <p className="muted-note">{group.reason}</p>
      <label>
        候选套装
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
        {saving ? '正在确认…' : `确认该组为 ${sets.find((set) => set.id === setId)?.name ?? setId}`}
      </button>
    </article>
  )
}
