import { EffectDescription } from "../components/EffectDescription";
import { ExplanationPopover } from "../components/ExplanationPopover";
import { playerConditionLines } from "../application/playerDecisionPresentation";
import type { TeamExecutionAttributePanel } from "./teamExecutionAttributePanel";

/** Keep sourced targets and skill conditions intact, outside the numeric comparison. */
export function TeamExecutionGraduationReference({
  panel,
  identity,
}: {
  panel: TeamExecutionAttributePanel;
  identity: string;
}) {
  const targets = panel.rows.filter((row) => row.targetStatus !== "missing");
  if (!targets.length && !panel.source.target.conditions?.length) return null;
  const notes = playerConditionLines(
    targets.length
      ? [panel.copy.target]
      : [panel.copy.target, ...(panel.source.target.conditions ?? [])],
  );
  return (
    <ExplanationPopover
      key={identity}
      label="毕业推荐"
      title="毕业推荐适用条件"
      className="team-execution__graduation-reference"
    >
      {notes.map(({ text }) => (
        <p key={text}>
          <EffectDescription text={text} />
        </p>
      ))}
      {targets.length ? (
        <dl className="team-execution__graduation-targets">
          {targets.map((row) => (
            <div key={row.key ?? row.label}>
              <dt>{row.label}</dt>
              <dd>
                <EffectDescription text={row.target} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </ExplanationPopover>
  );
}
