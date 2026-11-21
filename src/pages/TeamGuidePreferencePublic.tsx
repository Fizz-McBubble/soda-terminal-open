import { getAgentName } from '../application/publicRosterNames'
import { playerDecisionText } from './teamEquipmentParameterPresentation'
import {
  readTeamGuidePreferencePresentation,
  type TeamGuidePreferencePresentation,
} from '../domain/teamGuidePreferencePresentation'
export function TeamGuidePreference({
  memberIds,
  presentation,
}: {
  memberIds: readonly string[]
  presentation?: TeamGuidePreferencePresentation | null
}) {
  const view = readTeamGuidePreferencePresentation(presentation, memberIds)
  if (!view) return <p role="status">搭配说明尚未更新，请重新分析当前队伍。</p>
  if (!view.facts.length) return null
  const { facts } = view
  const preferredReplacements = [
    ...new Set(
      facts.flatMap((fact) =>
        fact.alternativeMemberIds.every((id) => memberIds.includes(id))
          ? fact.preferredMemberIds.filter((id) => !memberIds.includes(id)).map(getAgentName)
          : [],
      ),
    ),
  ]
  return (
    <details className="f5v-box-team-combat-evidence">
      <summary>
        <span className="f5v-box-team-combat-evidence__chevron" aria-hidden="true">
          ▸
        </span>
        {preferredReplacements.length
          ? `同核心搭配：缺少${preferredReplacements.join('、')}时替代`
          : '同核心搭配：优先搭配'}
      </summary>
      <ul>
        {facts.map((fact) => {
          const preferred = fact.preferredMemberIds.every((id) => memberIds.includes(id))
          const replacement = (preferred ? fact.alternativeMemberIds : fact.preferredMemberIds)
            .filter((id) => !memberIds.includes(id))
            .map(getAgentName)
            .join('、')
          return (
            <li key={fact.claimId}>
              {preferred
                ? `这套成员组合更常作为优先搭配，可用${replacement}替补。`
                : `缺少${replacement}时，可用这套搭配过渡。`}{' '}
              {playerDecisionText(fact.reason)}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
