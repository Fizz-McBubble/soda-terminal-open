import { useState } from 'react'
import { getAgentName } from '../application/publicRosterNames'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { ExplanationPopover } from '../components/ExplanationPopover'
import type { TeamLoadoutCompletionCandidate } from './teamLoadoutCompletionCandidates'
import { TEAM_RECOMMENDATION_PAGE_SIZE, TeamLoadoutPagination } from './TeamLoadoutPagination'
import { playerDecisionText } from './teamEquipmentParameterPresentation'

export function TeamCompletionCandidates({
  candidates,
}: {
  candidates: readonly TeamLoadoutCompletionCandidate[]
}) {
  if (!candidates.length) return null
  // Content identity resets pagination for a new group without resetting on a cloned array.
  const identity = JSON.stringify(
    candidates.map(({ id, ownedAgentIds, missingAgentIds }) => [
      id,
      ownedAgentIds,
      missingAgentIds,
    ]),
  )
  return <TeamCompletionCandidatesPage key={identity} candidates={candidates} />
}

function TeamCompletionCandidatesPage({
  candidates,
}: {
  candidates: readonly TeamLoadoutCompletionCandidate[]
}) {
  const [page, setPage] = useState(1)
  const pageCount = Math.ceil(candidates.length / TEAM_RECOMMENDATION_PAGE_SIZE)
  const currentPage = Math.min(page, pageCount)
  const visibleCandidates = candidates.slice(
    (currentPage - 1) * TEAM_RECOMMENDATION_PAGE_SIZE,
    currentPage * TEAM_RECOMMENDATION_PAGE_SIZE,
  )

  return (
    <section className="f5v-box-team-completion" aria-labelledby="f5v-box-team-completion-title">
      <header>
        <h3 id="f5v-box-team-completion-title" tabIndex={-1}>
          补强建议
        </h3>
        <p>补齐一位角色，可解锁以下配队方向</p>
      </header>
      <ul>
        {visibleCandidates.map((candidate) => (
          <li
            key={candidate.id}
            data-failure-code={candidate.failureCode}
            data-source-ids={candidate.sourceIds.join(',')}
          >
            <div className="f5v-box-team-completion__identities" aria-hidden="true">
              {[...candidate.ownedAgentIds, ...candidate.missingAgentIds].map((agentId) => (
                <VisualEntityImage
                  key={agentId}
                  className={`f5v-box-team-completion__team-portrait${candidate.missingAgentIds.includes(agentId) ? ' is-missing' : ''}`}
                  entityType="agent"
                  entityId={agentId}
                  name={getAgentName(agentId)}
                  slotId="agent.square-avatar"
                  consumer="box.team-overview"
                />
              ))}
            </div>
            <div className="f5v-box-team-completion__copy">
              <strong className="f5v-box-team-completion__candidate-label">
                {candidate.label}
              </strong>
              <div className="f5v-box-team-completion__summary">
                <span
                  className="f5v-box-team-completion__owned"
                  title={`已有：${candidate.ownedAgentIds.map(getAgentName).join('、')}`}
                  aria-label={`已有：${candidate.ownedAgentIds.map(getAgentName).join('、')}`}
                >
                  已有 {candidate.ownedAgentIds.length} 位
                </span>
                <CompletionMemberRow
                  label="还缺"
                  note={
                    candidate.missingRole !== 'core' && candidate.missingAgentIds.length > 1
                      ? '任选一位'
                      : undefined
                  }
                  agentIds={candidate.missingAgentIds}
                  tone="missing"
                />
                {candidate.sourceConditions?.length || candidate.accountReferenceNotes?.length ? (
                  <ExplanationPopover
                    label="适用条件"
                    title="补强方向的适用条件与来源说明"
                    className="f5v-box-completion-condition"
                  >
                    {candidate.accountReferenceNotes?.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                    {candidate.sourceConditions?.length ? (
                      <ul>
                        {candidate.sourceConditions.map((condition) => (
                          <li key={condition}>{playerDecisionText(condition)}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p>以上是来源方向；补齐角色后，仍需结合这些养成、配装和操作条件复核。</p>
                  </ExplanationPopover>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <TeamLoadoutPagination
        label="补强建议分页（底部）"
        page={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </section>
  )
}

function CompletionMemberRow({
  label,
  note,
  agentIds,
  tone,
}: {
  label: string
  note?: string
  agentIds: readonly string[]
  tone: 'owned' | 'missing'
}) {
  return (
    <div className={`f5v-box-team-completion__member-row is-${tone}`}>
      <span className="f5v-box-team-completion__member-label">
        {label}
        {note ? <small>{note}</small> : null}
      </span>
      <span className="f5v-box-team-completion__member-identities">
        {agentIds.map((agentId) => (
          <span className="f5v-box-team-completion__member-identity" key={agentId}>
            <span>{getAgentName(agentId)}</span>
          </span>
        ))}
      </span>
    </div>
  )
}
