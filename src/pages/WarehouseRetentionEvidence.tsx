import { useState } from 'react'
import type { DriveDisc } from '../domain/schemas'
import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import { readableAgentName } from './warehouseFactLabels'
import { playerRetentionCopy } from './warehouseRetentionCopy'
import { RetentionScoreDetails, RetentionSourceDetails } from './WarehouseRetentionDetails'
import { WarehouseRetentionUse } from './WarehouseRetentionUse'

/** Read-only player guidance; the underlying policy and provenance stay available. */
export function WarehouseRetentionEvidence({
  evidence,
  discLevel,
  disc,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  discLevel: number
  disc?: DriveDisc
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const copy = playerRetentionCopy(evidence, discLevel)
  const owned = new Set(evidence.ownedUseAgentIds)
  const witnesses = new Set(evidence.witnessProfileIds ?? [])
  const uses = [...evidence.leadingUses]
    .sort(
      (a, b) =>
        Number(witnesses.has(b.profileId)) - Number(witnesses.has(a.profileId)) ||
        Number(owned.has(b.agentId)) - Number(owned.has(a.agentId)),
    )
    .filter((use, index, rows) => rows.findIndex((row) => row.agentId === use.agentId) === index)
    .slice(0, 3)
  const selected = uses.find((use) => use.profileId === selectedId) ?? uses[0]
  const blockers = [...(evidence.blockedBy ?? [])]
  const blockerKey = (blocker: (typeof blockers)[number]) =>
    `${blocker.profileId ?? ''}|${blocker.field}|${blocker.predicateId}`
  const decisionBlockers = new Set(blockers.map(blockerKey))
  const alternativeBlockers = [
    ...new Map(
      evidence.leadingUses
        .flatMap((use) => use.blockers ?? [])
        .filter((blocker) => !decisionBlockers.has(blockerKey(blocker)))
        .map((blocker) => [blockerKey(blocker), blocker]),
    ).values(),
  ]
  return (
    <section className="warehouse-retention" aria-label="绝对品质与成长证据">
      <p role="status" className="warehouse-retention__action">
        <strong>{copy.title}</strong>
      </p>
      <p className="warehouse-retention__reason">{copy.explanation}</p>
      {copy.stop ? <p className="warehouse-retention__stop">{copy.stop}</p> : null}
      {uses.length ? (
        <div className="warehouse-retention__uses">
          <p>适用角色</p>
          <ul aria-label="参考角色用途">
            {uses.map((use) => (
              <li key={use.agentId}>
                <button
                  type="button"
                  aria-pressed={selected?.profileId === use.profileId}
                  onClick={() => setSelectedId(use.profileId)}
                >
                  <strong>{readableAgentName(use.agentId)}</strong>
                  <span title={owned.has(use.agentId) ? undefined : '未拥有，可作储备用途'}>
                    {owned.has(use.agentId) ? '已拥有' : '储备'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {selected ? <WarehouseRetentionUse use={selected} disc={disc} discLevel={discLevel} /> : null}
      <RetentionScoreDetails evidence={evidence} use={selected} />
      <RetentionSourceDetails evidence={evidence} blockers={blockers} use={selected} />
      {alternativeBlockers.length ? (
        <details className="warehouse-retention__details">
          <summary>其他用途待确认事项</summary>
          <p>这些条件只影响相应用途，不改变上方建议。</p>
          <RetentionSourceDetails evidence={evidence} blockers={alternativeBlockers} />
        </details>
      ) : null}
    </section>
  )
}
