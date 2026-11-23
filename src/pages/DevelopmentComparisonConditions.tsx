import { useState } from 'react'
import { PlayerSelect } from '../components/PlayerSelect'
import type { ReviewedEventConditionDeclarations32 } from '../calculation/reviewedEventConditionDeclarations32'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'

type State = 'unknown' | 'inactive' | 'active'
type Field =
  | 'steelCushionHitBehind'
  | 'firstPlumageAnomalyCritWindowActive'
  | 'mind'
  | 'inside'
  | 'cap'
const labels: Record<Field, string> = {
  steelCushionHitBehind: '钢铁肉垫：本次背后命中',
  firstPlumageAnomalyCritWindowActive: '涅槃初翎：火伤增益生效',
  mind: '叶瞬光：澄明心境与帷幕生效',
  inside: '叶瞬光：目标位于帷幕内',
  cap: '叶瞬光：裁决易伤已达上限',
}
const state = (value: boolean | null | undefined): State =>
  value === true ? 'active' : value === false ? 'inactive' : 'unknown'
const boolean = (value: State) => (value === 'unknown' ? undefined : value === 'active')
const selections = (
  current: ReviewedTemplateEventConditionDeclaration32 | undefined,
): Record<Field, State> => ({
  steelCushionHitBehind: state(current?.steelCushionHitBehind),
  firstPlumageAnomalyCritWindowActive: state(current?.firstPlumageAnomalyCritWindowActive),
  mind: state(current?.ye?.yeShunguangEnlightenedMind32),
  inside: state(current?.ye?.yeShunguangVerdictTargetInside32),
  cap: state(current?.ye?.yeShunguangVerdictAtCap32),
})

/** Only observations that a fixed personal comparison cannot derive from its own model. */
export function DevelopmentComparisonConditions({
  agentId,
  engineIds,
  declarations,
  pending,
  onApply,
}: {
  agentId: string
  engineIds: readonly (string | null | undefined)[]
  declarations?: ReviewedEventConditionDeclarations32
  pending: boolean
  onApply: (next: ReviewedEventConditionDeclarations32) => void | Promise<void>
}) {
  const current = declarations?.[agentId]
  const original = selections(current)
  const [selected, setSelected] = useState(() => original)
  const [vulnerability, setVulnerability] = useState(() =>
    current?.ye?.yeShunguangVerdictVulnerability32 == null
      ? ''
      : String(current.ye.yeShunguangVerdictVulnerability32 * 100),
  )
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const visible: Field[] = [
    ...(engineIds.includes('wengine-14102') ? ['steelCushionHitBehind' as const] : []),
    ...(engineIds.includes('wengine-14164')
      ? ['firstPlumageAnomalyCritWindowActive' as const]
      : []),
    ...(agentId === 'agent-ye-shunguang'
      ? [
          'mind' as const,
          'inside' as const,
          ...(selected.inside === 'active' ? ['cap' as const] : []),
        ]
      : []),
  ]
  if (!visible.length) return null
  const originalVulnerability = current?.ye?.yeShunguangVerdictVulnerability32
  const numeric = vulnerability.trim() === '' ? undefined : Number(vulnerability) / 100
  const valid = numeric === undefined || (Number.isFinite(numeric) && numeric >= 0 && numeric <= 2)
  const changed =
    visible.some((field) => selected[field] !== original[field]) ||
    (agentId === 'agent-ye-shunguang' && numeric !== originalVulnerability)
  const apply = async () => {
    const next: ReviewedTemplateEventConditionDeclaration32 = {
      ...current,
      sourceRefs: [
        ...new Set([...(current?.sourceRefs ?? []), 'player:explicit-fixed-event-comparison']),
      ],
    }
    for (const field of visible) {
      if (selected[field] === original[field]) continue
      const value = boolean(selected[field])
      if (field === 'steelCushionHitBehind' || field === 'firstPlumageAnomalyCritWindowActive') {
        if (value === undefined) delete next[field]
        else next[field] = value
      } else {
        const key =
          field === 'mind'
            ? 'yeShunguangEnlightenedMind32'
            : field === 'inside'
              ? 'yeShunguangVerdictTargetInside32'
              : 'yeShunguangVerdictAtCap32'
        const ye = { ...next.ye }
        if (value === undefined) delete ye[key]
        else ye[key] = value
        if (field === 'mind') {
          if (value === undefined) delete ye.yeShunguangVerdictActive32
          else ye.yeShunguangVerdictActive32 = value
        }
        if (Object.keys(ye).length) next.ye = ye
        else delete next.ye
      }
    }
    if (agentId === 'agent-ye-shunguang' && numeric !== originalVulnerability) {
      const ye = { ...next.ye }
      if (numeric === undefined) delete ye.yeShunguangVerdictVulnerability32
      else ye.yeShunguangVerdictVulnerability32 = numeric
      if (Object.keys(ye).length) next.ye = ye
      else delete next.ye
    }
    setApplying(true)
    setError(null)
    try {
      await onApply({ ...declarations, [agentId]: next })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '比较条件未更新，请重试。')
    } finally {
      setApplying(false)
    }
  }
  return (
    <div className="development-comparison-conditions" aria-label="本次比较条件">
      {visible.map((field) => (
        <label key={field}>
          <span>{labels[field]}</span>
          <PlayerSelect
            aria-label={labels[field]}
            value={selected[field]}
            disabled={pending || applying}
            onChange={(value) => setSelected((old) => ({ ...old, [field]: value as State }))}
          >
            <option value="unknown">未知</option>
            <option value="inactive">未发生</option>
            <option value="active">已发生</option>
          </PlayerSelect>
        </label>
      ))}
      {agentId === 'agent-ye-shunguang' &&
      selected.inside === 'active' &&
      selected.cap !== 'active' ? (
        <label>
          <span>裁决易伤（%）</span>
          <input
            type="number"
            min="0"
            max="200"
            step="any"
            aria-label="裁决易伤（%）"
            value={vulnerability}
            disabled={pending || applying}
            onChange={(event) => setVulnerability(event.target.value)}
          />
        </label>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <button
        type="button"
        className="button"
        disabled={pending || applying || !changed || !valid}
        onClick={() => void apply()}
      >
        应用比较条件
      </button>
    </div>
  )
}
