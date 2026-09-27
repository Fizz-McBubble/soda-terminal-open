import { ExplanationPopover } from '../components/ExplanationPopover'
import type { BangbooConditionPresentation } from '../application/publicBangbooConditionPresentation'

export function BangbooConditionDetailsView({
  condition,
}: {
  condition: BangbooConditionPresentation
}) {
  return (
    <div className="team-execution__bangboo-conditions" aria-live="polite">
      <div className="team-execution__bangboo-status-row">
        <p>
          <strong>
            {condition.activationStatus === 'active'
              ? '额外能力已激活'
              : condition.activationStatus === 'inactive'
                ? '额外能力未激活'
                : '额外能力待确认'}
          </strong>
        </p>
        <ExplanationPopover label="技能与触发条件">
          <p>
            {condition.requirementSummary}；{condition.progressSummary}
          </p>
          {condition.additionalAbility ? (
            <p>
              <b>{condition.additionalAbility.name}</b>：
              {condition.additionalAbility.effectDescription ||
                condition.additionalAbility.description}
            </p>
          ) : null}
          {condition.baseSkills.map((skill) => (
            <p key={skill.kind}>
              <b>
                {skill.label} · {skill.name}
              </b>
              ：{skill.description}
            </p>
          ))}
        </ExplanationPopover>
      </div>
    </div>
  )
}
