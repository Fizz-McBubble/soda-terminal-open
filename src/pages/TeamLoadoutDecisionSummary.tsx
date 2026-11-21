import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { presentTeamDecision } from './teamLoadoutVisibleDecisionText'
import type { TeamDecisionPresentation } from './teamLoadoutVisibleDecisionText'
import { DecisionConditions } from '../components/DecisionConditions'
import {
  presentTeamRotationSummary,
  type TeamRotationSummarySource,
} from './teamRotationSummaryPresentation'

function isGenericPotentialCycleClause(clause: string) {
  const compact = clause.replace(/\s+/gu, '')
  return /^(?:已注明的?)?潜能(?:影像)?(?:与|和)循环条件(?:均)?需满足[。；;]?$/u.test(compact)
}

function isSourceRatingClause(clause: string) {
  const compact = clause.replace(/\s+/gu, '')
  return (
    (/对应本工具/u.test(compact) && /档/u.test(compact)) ||
    (/^(?:参考评级|来源评级)/u.test(compact) && /(?:更多|独立).*对照/u.test(compact))
  )
}

function isSourceMetadataOnlyClause(clause: string) {
  const compact = clause.replace(/\s+/gu, '')
  return (
    /^(?:较早|旧|历史|当前)?版本[（(]\d+(?:\.\d+)*[）)](?:[｜|](?:队|队伍|版本|来源)?)?[。；;]?$/u.test(
      compact,
    ) || /^(?:来源|出处|版本)[：:｜|][^。；;，,]{0,24}[。；;]?$/u.test(compact)
  )
}

function visibleConditions(conditions: readonly string[]) {
  return [
    ...new Set(
      conditions
        .map((condition) =>
          condition
            .split(/(?<=[；;。])/u)
            .filter(
              (clause) =>
                !isGenericPotentialCycleClause(clause) &&
                !isSourceRatingClause(clause) &&
                !isSourceMetadataOnlyClause(clause),
            )
            .join('')
            .replace(/^较早版本（[^）]+）[｜|]\s*/u, '')
            .replace(/^[；;，,\s]+/u, '')
            .trim(),
        )
        .filter(Boolean),
    ),
  ]
}

/** Read the selected presentation only; this surface does not assign eligibility or rank. */
export function TeamLoadoutDecisionSummary({
  item,
  presentation,
  rotationSummaries,
}: {
  item: TeamLoadoutOverviewItem
  presentation?: TeamDecisionPresentation
  rotationSummaries?: TeamRotationSummarySource
}) {
  const { reason, roles, conditions } = presentation ?? presentTeamDecision(item)
  const rotation = presentTeamRotationSummary(item, rotationSummaries)
  const distinctReason = roles
    .reduce((text, role) => text.replace(role.purpose, ''), reason)
    .replace(/[。；;，、\s]/gu, '')
  return (
    <section className="f5v-box-team-decision-summary" aria-label="所选搭配建议与条件">
      {distinctReason && reason !== '先查看这队的配装与使用条件。' ? (
        <p className="f5v-box-team-decision-summary__reason">{reason}</p>
      ) : null}
      <DecisionConditions conditions={visibleConditions(conditions)} />
      {rotation ? (
        <div className="f5v-box-team-rotation-summary">
          <h3>输出手法</h3>
          <p>
            <strong>开场：</strong>
            {rotation.opening}
          </p>
          {rotation.handoff?.trim() ? (
            <p>
              <strong>交接：</strong>
              {rotation.handoff}
            </p>
          ) : null}
          <p>
            <strong>循环：</strong>
            {rotation.loop}
          </p>
          <p>
            <strong>爆发：</strong>
            {rotation.burst}
          </p>
        </div>
      ) : null}
    </section>
  )
}
