import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import { readableAgentName } from './warehouseFactLabels'
import { playerRetentionCopy } from './warehouseRetentionCopy'
import { RetentionScoreDetails, RetentionSourceDetails } from './WarehouseRetentionDetails'

/** Read-only player guidance; the underlying policy and provenance stay available. */
export function WarehouseRetentionEvidence({
  evidence,
  discLevel,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  discLevel: number
}) {
  const copy = playerRetentionCopy(evidence, discLevel)
  const owned = new Set(evidence.ownedUseAgentIds)
  const uses = [...new Map(evidence.leadingUses.map((use) => [use.agentId, use])).values()]
    .sort((a, b) => Number(owned.has(b.agentId)) - Number(owned.has(a.agentId)))
    .slice(0, 3)
  const blockers = [
    ...new Map(
      [
        ...(evidence.blockedBy ?? []),
        ...evidence.leadingUses.flatMap((use) => use.blockers ?? []),
      ].map((blocker) => [
        `${blocker.profileId ?? ''}|${blocker.field}|${blocker.predicateId}`,
        blocker,
      ]),
    ).values(),
  ]
  return (
    <section className="warehouse-retention" aria-label="绝对品质与成长证据">
      <h3>处理建议</h3>
      <p role="status" className="warehouse-retention__action">
        <strong>{copy.title}</strong>
      </p>
      <p className="warehouse-retention__reason">{copy.explanation}</p>
      {copy.stop ? <p className="warehouse-retention__stop">{copy.stop}</p> : null}
      {uses.length ? (
        <div className="warehouse-retention__uses">
          <p>参考用途</p>
          <ul aria-label="参考角色用途">
            {uses.map((use) => (
              <li key={use.agentId}>
                <strong>{readableAgentName(use.agentId)}</strong>
                <span title={owned.has(use.agentId) ? undefined : '未拥有，可作储备用途'}>
                  {owned.has(use.agentId) ? '已拥有' : '储备'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <RetentionScoreDetails
        evidence={evidence}
        visibleExplanation={copy.explanation}
        visibleStop={copy.stop}
      />
      <RetentionSourceDetails evidence={evidence} blockers={blockers} />
    </section>
  )
}
