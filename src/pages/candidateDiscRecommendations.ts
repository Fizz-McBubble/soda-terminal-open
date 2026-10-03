import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import { getAgentName } from '../application/publicRosterNames'
import { getAgentSpecialtyLabel } from '../assault/catalog'
import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import {
  candidateSetPlanPriority,
  candidateSetPlanIdentity,
} from '../gameDataPacks/candidateSetPlanPolicy'
import { discSetRecommendation } from './agentDevelopmentWorkbenchModel'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import {
  twoPieceRecommendationPriority,
  type TwoPiecePanelContext,
} from './twoPieceRecommendationPriority'

function recommendationConditionHint(plan: CandidateSetPlan): string | undefined {
  const rule = plan.condition?.rule
  if (!rule) return undefined
  if (rule.kind === 'electric_team') return '电队适用'
  if (rule.kind === 'teammate') return `与${getAgentName(rule.agentId)}同队时`
  if (rule.kind === 'teammate_specialty_and_action') {
    const roles = rule.specialties.map(getAgentSpecialtyLabel).join(' / ')
    const action = rule.action === 'wearer_ex_special' ? '自身强化特殊技' : '队伍快速支援'
    return `${roles}队友与${action}条件；效果窗口另行核验`
  }
  const setName = discSetRecommendation(rule.setId).name
  return rule.kind === 'teammate_four_piece' ? `队友已穿${setName}4件时` : `队友未穿${setName}4件时`
}

/** Display every source branch without inventing combinations across branches. */
export function candidateDiscRecommendations(
  plans: readonly CandidateSetPlan[],
  constraint?: CandidateWarehouseConstraint | null,
  panelContext?: TwoPiecePanelContext,
): GoldenWorkbenchData['graduation']['discs']['sets'] {
  const rows = plans.flatMap((plan): GoldenWorkbenchData['graduation']['discs']['sets'] => {
    const priority = candidateSetPlanPriority(plan)
    if (plan.pattern === '2+2+2') {
      const pieces = plan.primarySetIds.map((id) => {
        const set = discSetRecommendation(id)
        return { entityId: id, name: set.name, effect: set.twoPieceEffect, count: 2 as const }
      })
      return [
        {
          label: `2+2+2 · ${pieces.map((piece) => piece.name).join(' / ')}${pieces.length > 3 ? '（任选3套）' : ''}`,
          pieces,
          recommendationPriority: priority,
          recommendationExplicitlyRanked: Number.isFinite(plan.priority),
          recommendationGroup: candidateSetPlanIdentity(plan),
          recommendationPurpose: plan.purpose,
          recommendationConditionHint: recommendationConditionHint(plan),
          recommendationExplanation: plan.sourceText,
        },
      ]
    }
    return plan.primarySetIds.flatMap((primaryId) =>
      plan.secondarySetIds
        .filter((id) => id !== primaryId)
        .map((secondaryId) => {
          const primary = discSetRecommendation(primaryId)
          const secondary = discSetRecommendation(secondaryId)
          const twoPiecePriority = constraint
            ? twoPieceRecommendationPriority(secondaryId, constraint, primaryId, panelContext)
            : undefined
          return {
            label: `${primary.name} 4件 + ${secondary.name} 2件`,
            recommendationPriority: priority,
            recommendationExplicitlyRanked: Number.isFinite(plan.priority),
            recommendationGroup: `${candidateSetPlanIdentity(plan)}|${primaryId}`,
            recommendationPurpose: plan.purpose,
            recommendationConditionHint: recommendationConditionHint(plan),
            recommendationExplanation: plan.sourceText,
            twoPiecePriority,
            fourPiece: {
              entityId: primaryId,
              name: primary.name,
              effect: primary.fourPieceEffect,
            },
            twoPiece: {
              entityId: secondaryId,
              name: secondary.name,
              effect: secondary.twoPieceEffect,
            },
          }
        })
        .sort((a, b) => (a.twoPiecePriority?.order ?? 0) - (b.twoPiecePriority?.order ?? 0)),
    )
  })
  return rows.map((row) => {
    if (!row.twoPiecePriority || !row.fourPiece) return row
    const equivalent = rows.some(
      (other) =>
        other !== row &&
        other.recommendationPriority === row.recommendationPriority &&
        other.fourPiece?.entityId === row.fourPiece?.entityId &&
        other.twoPiecePriority?.effectKey === row.twoPiecePriority?.effectKey,
    )
    return equivalent
      ? {
          ...row,
          twoPiecePriority: {
            ...row.twoPiecePriority,
            label: `并列 · ${row.twoPiecePriority.label}`,
            reason: `${row.twoPiecePriority.reason} 同效副套按副词条选。`,
          },
        }
      : row
  })
}
