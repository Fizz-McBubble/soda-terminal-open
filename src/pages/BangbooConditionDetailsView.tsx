import { ExplanationPopover } from '../components/ExplanationPopover'
import { EffectDescription } from '../components/EffectDescription'
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
        <ExplanationPopover
          label="技能与触发条件"
          align="start"
          className="team-execution__bangboo-details"
        >
          {condition.purposeSummary ? (
            <section>
              <h4>队伍用途</h4>
              <p>
                <EffectDescription text={condition.purposeSummary} />
              </p>
            </section>
          ) : null}
          <section>
            <h4>触发条件</h4>
            <p>
              <EffectDescription text={condition.requirementSummary} />
            </p>
            <p>
              <EffectDescription text={condition.progressSummary} />
            </p>
          </section>
          {condition.additionalAbility ? (
            <section>
              <h4>额外能力 · {condition.additionalAbility.name}</h4>
              <p>
                <EffectDescription
                  text={
                    condition.additionalAbility.effectDescription ||
                    condition.additionalAbility.description
                  }
                />
              </p>
            </section>
          ) : null}
          {condition.baseSkills.map((skill) => (
            <section key={skill.kind}>
              <h4>
                {skill.label} · {skill.name}
              </h4>
              <p>
                <EffectDescription text={skill.description} />
              </p>
            </section>
          ))}
        </ExplanationPopover>
      </div>
    </div>
  )
}
