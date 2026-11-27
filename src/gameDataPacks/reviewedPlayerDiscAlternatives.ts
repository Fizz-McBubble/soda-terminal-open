import type { CandidateSetPlan } from './candidateSetPlans'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import { stableContentHash } from './types'

const plan: CandidateSetPlan = {
  pattern: '4+2',
  primarySetIds: ['set-dawns-bloom'],
  secondarySetIds: ['set-wuthering-salon'],
  purpose: 'recommended',
  sourceText: '赛维里安的社区备选：拂晓生花4件＋呼啸沙龙2件。',
}

const sources = [
  {
    id: 'prydwen-severian-salon-20261127',
    url: 'https://www.prydwen.gg/zenless/characters/severian',
  },
  {
    id: 'icy-veins-severian-salon-20261127',
    url: 'https://www.icy-veins.com/zenless-zone-zero/severian-guide-best-builds',
  },
].map((source) => ({
  ...source,
  sourceVersion: '3.3',
  checkedAt: '2026-11-27',
  contentHash: stableContentHash({ ...source, plan }),
  verified: true,
  licenseBoundary: '采用结构化的主副套搭配事实，原攻略与计算表留在作者站点。',
}))

export type ReviewedPlayerDiscBinding = { id: string; sourceHash: string }

const id = 'community-dawns-bloom-salon'
const binding: ReviewedPlayerDiscBinding = {
  id,
  sourceHash: stableContentHash(sources.map((source) => [source.id, source.contentHash])),
}

/** Reviewed player alternative for 3.3, independent of the certified team-rating reference. */
export function reviewedPlayerDiscAlternative(constraint?: CandidateWarehouseConstraint | null) {
  return constraint?.agentId === 'agent-severian' && constraint.gameVersion === '3.3'
    ? { id, binding, plan, sources }
    : undefined
}
