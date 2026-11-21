import { resolveReviewedContextualTargetPanelContinuity33 } from './reviewedBuildFieldContinuity33'
import {
  currentAgentEventContracts,
  evaluateCurrentAgentTeamActivation,
} from '../calculation/currentAgentMechanicContracts'
import { currentVersionProjection } from './currentVersionProjection'
import { reviewedTargetPanelGuidance } from './reviewedTargetPanelGuidance'
import { reviewedTeamDiscDirections } from './reviewedTeamDiscConditions'

import type { CurrentBuildTargetPanelContext } from './currentBuildAuthorityTypes'
/** Local 3.2 review retains the author's traditional numerical references. It
 * does not turn an older build calculation into a current graduation threshold. */
export function reviewedMiyabiTraditionalPanel32(
  context: CurrentBuildTargetPanelContext | undefined,
) {
  const members = context?.memberIds
  if (!members || members.length !== 3 || new Set(members).size !== 3) return null
  const sourceTeam = [
    ['agent-miyabi', 'agent-lycaon', 'agent-soukaku'],
    ['agent-miyabi', 'agent-remielle', 'agent-burnice'],
  ].find((team) => team.every((id) => members.includes(id)))
  if (!sourceTeam || !['3.2', '3.3'].includes(currentVersionProjection.gameVersion)) return null
  const state = context.agentStateById?.['agent-miyabi']
  const mindscape = state && Object.hasOwn(state, 'mindscape') ? state.mindscape : context.mindscape
  if (
    typeof mindscape !== 'number' ||
    !Number.isInteger(mindscape) ||
    mindscape < 0 ||
    mindscape > 6 ||
    (context.mindscape !== undefined && context.mindscape !== mindscape) ||
    context.selectedDirectionIdByAgentId?.['agent-miyabi']
  )
    return null
  const mechanic = currentAgentEventContracts.find((row) => row.stableId === 'agent-miyabi')
  if (
    mechanic?.source.formulaSha256.toLowerCase() !==
      '7c7e1f1aeda1d38976d4c0b47c111eb0b4fc76dfe0e6554b567d8260df8127f3' ||
    mechanic.source.statsSha256.toLowerCase() !==
      '1dbfcdce806774269df8e69837308bdaaf547928339ef8be8425cb34300f4443'
  )
    return null
  const activation = evaluateCurrentAgentTeamActivation({
    stableId: 'agent-miyabi',
    memberIds: members,
    agentState: { mindscape, potentialImage: state?.potentialImage },
  })
  if (activation.status !== 'supported' || !activation.active) return null
  const original = reviewedTargetPanelGuidance('agent-miyabi')
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  if (!original || !isRecord(original.value)) return null
  const originalValue = original.value
  const originalSourceMetadata = originalValue.sourceMetadata
  const targetSemantics = originalValue.targetSemantics
  if (
    !isRecord(originalSourceMetadata) ||
    originalSourceMetadata.sourceId !== 'prydwen-miyabi-current-2026-08-05' ||
    !isRecord(targetSemantics) ||
    Object.values(targetSemantics).some((semantic) => !isRecord(semantic))
  )
    return null
  const frozenPrydwenPayload = 'fnv1a-a275dbdf'
  const originalSource = original.sourceRefs.find(
    (source) => source.id === 'prydwen-miyabi-current-2026-08-05',
  )
  // The traditional numbers were reviewed as one frozen payload. Any source
  // edit invalidates the 3.2 team review until those numbers are reviewed again.
  if (
    originalSource?.contentHash?.toLowerCase() !== frozenPrydwenPayload ||
    typeof originalSourceMetadata.observedPayloadHash !== 'string' ||
    originalSourceMetadata.observedPayloadHash.toLowerCase() !== frozenPrydwenPayload
  )
    return null
  const conditions = [
    ...(original.conditions ?? []),
    '作者构筑复审为2.1、玩法复审为1.5；2026-09-30仅为页面更新。本地3.2按明确传统队与当前机制复核，数值仅作培养参考，不作为毕业硬门。',
    '暴击率75–95%、暴伤150–190%、攻击2500–3600及精通240等保留作者配装参考；80%仅为战斗霜染积蓄转换封顶，不假定影画与四件套窗口已激活。',
  ]
  const teamSource = members.includes('agent-remielle')
    ? reviewedTeamDiscDirections.find((row) => row.agentId === 'agent-miyabi')?.source
    : undefined
  if (members.includes('agent-remielle') && teamSource?.localReviewVersion !== '3.2') return null
  const panel = {
    value: {
      ...originalValue,
      targetSemantics: Object.fromEntries(
        Object.entries(targetSemantics).map(([key, semantic]) => [
          key,
          { ...(semantic as Record<string, unknown>), observation: 'reference' as const },
        ]),
      ),
      cultivationReference: {
        keys: ['atk', 'critRate', 'critDamage', 'anomalyProficiency', 'anomalyMastery'],
        conditions,
        sourceVersion: original.gameVersion,
        level: 60,
      },
      sourceMetadata: {
        ...originalSourceMetadata,
        authorBuildReviewVersion: '2.1',
        authorGameplayReviewVersion: '1.5',
        authorProfileUpdatedAt: '2026-09-30',
        localReviewVersion: '3.2',
        localReviewedAt: '2026-10-19',
        localReviewScope: 'source_named_traditional_team_cultivation_reference_only',
      },
    },
    status: original.status,
    gameVersion: '3.2',
    sourceRefs: [
      ...original.sourceRefs.map((source) => ({ ...source, evaluatedForVersion: '3.1' })),
      {
        id: 'miyabi-traditional-panel-local-review32-20261019',
        sourceVersion: null,
        evaluatedForVersion: '3.2',
        checkedAt: '2026-10-19',
        contentHash: 'CF94D68F5AF17346B8CE30A353955B44E6F0517DA0596FC307A4364010F7F214',
      },
      ...(teamSource
        ? [
            {
              id: `miyoushe-${teamSource.postId}:text:0167`,
              sourceVersion: teamSource.sourceVersion,
              evaluatedForVersion: teamSource.localReviewVersion ?? null,
              checkedAt: teamSource.localReviewedAt ?? null,
              contentHash: teamSource.contentHash,
            },
          ]
        : []),
    ],
    conditions,
  }
  if (currentVersionProjection.gameVersion === '3.2') return panel
  const referenceContinuity = resolveReviewedContextualTargetPanelContinuity33({
    targetVersion: currentVersionProjection.gameVersion,
    memberIds: members,
    ...panel,
    formulaBindings: members.flatMap((agentId) => {
      const actor = currentAgentEventContracts.find((row) => row.stableId === agentId)
      return actor ? [{ agentId, formulaSha256: actor.source.formulaSha256 }] : []
    }),
  })
  return referenceContinuity
    ? {
        ...panel,
        gameVersion: '3.3',
        referenceContinuity,
        evaluatedForVersion: '3.3',
        sourceReviewVersion: '3.2',
      }
    : null
}
