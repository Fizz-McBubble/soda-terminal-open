import { evaluateReviewedIncrementalEventBenchmark32 } from '../decision/reviewedIncrementalEventBenchmark32'
import {
  getReviewedEventCapability32,
  reviewedEventCapabilities32,
} from '../gameDataPacks/reviewedEventCapabilities32'
import {
  reviewedIncrementalEvent32Contract,
  reviewedIncrementalEventInputGaps32,
  reviewedIncrementalEventInputFingerprint32,
  reviewedIncrementalEventResultFingerprint32,
  type ReviewedIncrementalEventInput32Dto,
  type ReviewedIncrementalEventMetadata32,
  type ReviewedIncrementalEventResult32Dto,
} from './publicReviewedIncrementalEvent32'

export function projectReviewedIncrementalEventMetadata32(
  agentId: string,
  eventId?: string,
): ReviewedIncrementalEventMetadata32 | null {
  const capability = getReviewedEventCapability32(agentId, eventId)
  return capability
    ? {
        agentId,
        eventId: capability.eventId,
        availableEvents: reviewedEventCapabilities32
          .filter((row) => row.agentId === agentId)
          .map((row) => ({
            eventId: row.eventId,
            label: row.label,
            skill: row.eventId.split('.')[0]!,
          })),
        label: capability.label,
        family: capability.family,
        sourceLink: `https://github.com/frzyc/genshin-optimizer/blob/${capability.source.commit}/${capability.source.formulaPath}`,
        sourceFingerprint: capability.contentHash,
        scope: capability.contextScope,
      }
    : null
}

/** Private producer: the reviewed evaluator remains the only damage calculation. */
export function projectReviewedIncrementalEvent32(
  runId: string,
  input: ReviewedIncrementalEventInput32Dto,
): ReviewedIncrementalEventResult32Dto {
  const gaps = reviewedIncrementalEventInputGaps32(input)
  const evaluated = gaps.length ? null : evaluateReviewedIncrementalEventBenchmark32(input)
  const formal = evaluated?.status === 'formal'
  const payload: Omit<ReviewedIncrementalEventResult32Dto, 'resultFingerprint'> = {
    contract: reviewedIncrementalEvent32Contract,
    runId,
    inputFingerprint: reviewedIncrementalEventInputFingerprint32(input),
    sideEffect: 'read_only',
    subject: projectReviewedIncrementalEventMetadata32(input?.agentId, input?.eventId),
    status: formal ? 'formal_single_event' : 'unsupported',
    formalSingleEvent: formal,
    expectedDamage: formal ? evaluated.expectedDamage : null,
    gaps: gaps.length
      ? gaps
      : evaluated?.status === 'unsupported'
        ? evaluated.gaps
        : formal
          ? []
          : ['reviewed_single_event_not_formal'],
  }
  return { ...payload, resultFingerprint: reviewedIncrementalEventResultFingerprint32(payload) }
}
