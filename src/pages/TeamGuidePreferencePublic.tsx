import { getAgentName } from "../application/publicRosterNames";
import { playerDecisionText } from "./teamEquipmentParameterPresentation";
import {
  readTeamGuidePreferencePresentation,
  type TeamGuidePreferencePresentation,
} from "../domain/teamGuidePreferencePresentation";
export function TeamGuidePreference({
  memberIds,
  presentation,
}: {
  memberIds: readonly string[];
  presentation?: TeamGuidePreferencePresentation | null;
}) {
  const view = readTeamGuidePreferencePresentation(presentation, memberIds);
  if (!view) return <p role="status">搭配说明尚未更新，请重新分析当前队伍。</p>;
  if (!view.facts.length) return null;
  const { facts } = view;
  const preferredReplacements = [
    ...new Set(
      facts.flatMap((fact) =>
        fact.alternativeMemberIds.every((id) => memberIds.includes(id))
          ? fact.preferredMemberIds
              .filter((id) => !memberIds.includes(id))
              .map(getAgentName)
          : [],
      ),
    ),
  ];
  return (
    <section className="f5v-box-team-combat-evidence" aria-label="同核心搭配">
      <h3>
        {preferredReplacements.length
          ? `同核心搭配：缺少${preferredReplacements.join("、")}时替代`
          : "同核心搭配：优先搭配"}
      </h3>
      <ul>
        {facts.map((fact) => (
          <li key={fact.claimId}>{playerDecisionText(fact.reason)}</li>
        ))}
      </ul>
    </section>
  );
}
