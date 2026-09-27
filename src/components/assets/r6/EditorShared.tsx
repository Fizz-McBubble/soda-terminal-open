import { VisualEntityImage } from '../../VisualEntityImage'
import { useState } from 'react'
import type { CatalogItem } from './types'

export function Field({
  label,
  value,
  onChange,
  min = 0,
  max = 60,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  const [editing, setEditing] = useState<{ source: number; raw: string } | null>(null)
  const rawValue = editing?.source === value ? editing.raw : String(value)
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={rawValue}
        onChange={(event) => {
          const raw = event.target.value.trim()
          if (!raw) {
            setEditing({ source: value, raw: '' })
            return
          }
          const parsed = Number(raw)
          if (!Number.isFinite(parsed)) return
          const next = Math.min(max, Math.max(min, Math.trunc(parsed)))
          setEditing(null)
          onChange(next)
        }}
      />
    </label>
  )
}

export function Identity(item: CatalogItem, meta: string) {
  return (
    <header className={`identity identity--${item.entityType}`}>
      <VisualEntityImage
        entityType={item.entityType}
        entityId={item.stableId}
        slotId={
          item.entityType === 'agent'
            ? 'agent.square-avatar'
            : item.entityType === 'wengine'
              ? 'wengine.editor-identity'
              : item.entityType === 'bangboo'
                ? 'bangboo.editor-identity'
                : undefined
        }
        consumer={item.entityType === 'drive_disc_set' ? undefined : 'assets.editor'}
        name={item.playerName}
        className="identity-image"
      />
      <div>
        <small>当前账户</small>
        <h2>{item.playerName}</h2>
        <p>{meta}</p>
      </div>
    </header>
  )
}

export function Save({ label, onSave }: { label: string; onSave: () => void | Promise<void> }) {
  const [saving, setSaving] = useState(false)
  return (
    <footer className="editor-action">
      <small>只更新当前账户</small>
      <button
        className="primary"
        disabled={saving}
        onClick={() => {
          setSaving(true)
          void Promise.resolve(onSave()).finally(() => setSaving(false))
        }}
      >
        {label}
      </button>
    </footer>
  )
}
