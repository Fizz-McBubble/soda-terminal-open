import { playerFacingAgentLabel } from '../application/playerFacingLabels'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { TeamLoadoutMindscapeBadge } from './TeamLoadoutMindscapeBadge'
import { resolveMemberMindscapeDisplay } from './teamMemberMindscapePresentation'
import {
  presentTeamDecision,
  type TeamDecisionPresentation,
} from './teamLoadoutVisibleDecisionText'

export function TeamLoadoutPreviewMembers({
  item,
  agentIds,
  presentation,
}: {
  item: TeamLoadoutOverviewItem
  agentIds: readonly string[]
  presentation?: TeamDecisionPresentation
}) {
  const roles = (presentation ?? presentTeamDecision(item)).roles
  return (
    <div className="f5v-box-team-preview__members">
      <ol className="f5v-box-team-member-lineup" aria-label="成员分工">
        {agentIds.map((agentId) => {
          const role = roles.find((entry) => entry.agentId === agentId)
          const mindscape = resolveMemberMindscapeDisplay(
            agentId,
            item.formedTeamReference,
            item.currentMemberCultivation?.[agentId],
          )
          return (
            <li key={agentId} data-team-member-id={agentId}>
              <span className="f5v-box-team-member-visual">
                <VisualEntityImage
                  entityType="agent"
                  entityId={agentId}
                  name={role?.name ?? playerFacingAgentLabel(agentId)}
                  slotId="agent.square-avatar"
                  consumer="box.team-overview"
                />
                <TeamLoadoutMindscapeBadge display={mindscape} />
              </span>
              <div>
                <div className="f5v-box-team-member-name-line">
                  <h3>{role?.name ?? playerFacingAgentLabel(agentId)}</h3>
                  {mindscape.referenceMindscape === undefined ? null : (
                    <span
                      className="f5v-box-team-member-reference-mindscape"
                      title="成型队伍建议影画"
                    >
                      建议影画 {mindscape.referenceMindscape}
                    </span>
                  )}
                </div>
                {role?.label ? (
                  <span className="f5v-box-team-member-role">{role.label}</span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      {!item.bangbooId && !item.bangbooAlternativeIds?.length ? (
        <p className="f5v-box-team-bangboo-direction">
          {item.bangbooReason ?? '本队还没选邦布，进入配装后选择。'}
        </p>
      ) : null}
    </div>
  )
}
