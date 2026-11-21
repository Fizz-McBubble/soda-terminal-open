import type { CandidateSetPlan } from './candidateSetPlans'
import { currentGameDataSelection } from './currentGameDataSelection'

/** Player-facing references only; these records never enter candidate constraints or scoring. */
type ReviewedWorkbenchDiscSource = {
  id: string
  url: string
  author: string
  sourceVersion: string
  reviewedForVersion: string
  pagePublishedAt: string
  pageUpdatedAt: string | null
  reviewedAt: string
  observedAt: string
  evidenceFile: string
  evidenceSha256: string
  hashKind: string
}

export type ReviewedWorkbenchDiscReference = {
  source: ReviewedWorkbenchDiscSource
  additionalSources?: readonly ReviewedWorkbenchDiscSource[]
  minPotential?: number
  primaryNote?: string
  plans: readonly CandidateSetPlan[]
  planHints?: readonly (string | undefined)[]
  planSourceIds?: readonly string[]
}

const references: Readonly<Record<string, ReviewedWorkbenchDiscReference>> = {
  'agent-roxy': {
    source: {
      id: 'miyoushe-asgater-roxy-disc-78541126',
      url: 'https://www.miyoushe.com/zzz/article/78541126',
      author: 'Asgater',
      sourceVersion: '3.2',
      reviewedForVersion: '3.3',
      pagePublishedAt: '09-30',
      pageUpdatedAt: '10-02',
      reviewedAt: '2026-11-02',
      observedAt: '2026-11-02T14:08:57.927Z',
      evidenceFile: 'miyoushe-78541126-rendered.json',
      evidenceSha256: '92b91b1b6797ca991de045df36f1ed2bbe29f474e6cc892e5c7c6e6f9e40938b',
      hashKind: 'rendered_expanded_body_json_not_http_payload',
    },
    primaryNote: '搭配强攻、命破或锋御输出时，可选摇摆爵士4件，侧重失衡期增伤。',
    additionalSources: [
      {
        id: 'miyoushe-qingfeng-roxy-disc-78535279',
        url: 'https://www.miyoushe.com/zzz/article/78535279',
        author: 'HoYo青枫',
        sourceVersion: '3.2',
        reviewedForVersion: '3.3',
        pagePublishedAt: '09-30',
        pageUpdatedAt: '10-02',
        reviewedAt: '2026-11-02',
        observedAt: '2026-11-02T14:31:58.725Z',
        evidenceFile: 'miyoushe-78535279-review-excerpts.json',
        evidenceSha256: '54869f549da42b40e7b5824dcb2328ae08ae9098625a91488c9d4c9071e3d3c5',
        hashKind: 'manual_reviewed_excerpt_not_complete_dom',
      },
    ],
    planHints: [undefined, '锋御队可选', undefined, undefined],
    planSourceIds: [
      'miyoushe-asgater-roxy-disc-78541126',
      'miyoushe-qingfeng-roxy-disc-78535279',
      'miyoushe-qingfeng-roxy-disc-78535279',
      'miyoushe-asgater-roxy-disc-78541126',
    ],
    plans: [
      {
        pattern: '2+2+2',
        primarySetIds: ['set-swing-jazz', 'set-moonlight-lullaby', 'set-shockstar-disco'],
        secondarySetIds: [],
        purpose: 'recommended',
        sourceText: '2+2+2散搭参考',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-swing-jazz'],
        secondarySetIds: ['set-moonlight-lullaby'],
        purpose: 'conditional',
        sourceText: '锋御队可选；发动连携技或终结技后提升全队伤害。',
      },
      {
        pattern: '2+2+2',
        primarySetIds: ['set-swing-jazz', 'set-moonlight-lullaby', 'set-king-of-the-summit'],
        secondarySetIds: [],
        purpose: 'recommended',
        sourceText: '2+2+2散搭参考',
      },
      {
        pattern: '2+2+2',
        primarySetIds: ['set-swing-jazz', 'set-moonlight-lullaby', 'set-woodpecker-electro'],
        secondarySetIds: [],
        purpose: 'recommended',
        sourceText: '2+2+2散搭参考',
      },
    ],
  },
  'agent-dialyn': {
    source: {
      id: 'miyoushe-asgater-dialyn-disc-77534448',
      url: 'https://www.miyoushe.com/zzz/article/77534448',
      author: 'Asgater',
      sourceVersion: '3.1',
      reviewedForVersion: '3.3',
      pagePublishedAt: '08-17',
      pageUpdatedAt: null,
      reviewedAt: '2026-11-02',
      observedAt: '2026-11-02T22:19:41.489609+08:00',
      evidenceFile: '5-latest-posts/posts-and-deltas.json',
      evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      hashKind: 'review_notes_not_original_image',
    },
    plans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-king-of-the-summit'],
        secondarySetIds: ['set-shockstar-disco'],
        purpose: 'recommended',
        sourceText: '山大王4件通过强化特殊技或连携技触发；暴击率达到50%时另有暴击伤害加成。',
      },
    ],
  },
  'agent-nangong': {
    source: {
      id: 'miyoushe-asgater-nangong-disc-78041905',
      url: 'https://www.miyoushe.com/zzz/article/78041905',
      author: 'Asgater',
      sourceVersion: '3.2',
      reviewedForVersion: '3.3',
      pagePublishedAt: '09-08',
      pageUpdatedAt: null,
      reviewedAt: '2026-11-02',
      observedAt: '2026-11-02T22:19:41.489609+08:00',
      evidenceFile: '5-latest-posts/posts-and-deltas.json',
      evidenceSha256: 'f651b0a0788876b060bbe169230c79f66fa678d7562f9bebd9c22136c91e85e4',
      hashKind: 'review_notes_not_original_image',
    },
    plans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-phaethons-melody'],
        secondarySetIds: ['set-king-of-the-summit'],
        purpose: 'recommended',
        sourceText: '法厄同之歌4件的以太伤害增益需要队友触发。',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-freedom-blues'],
        secondarySetIds: ['set-phaethons-melody'],
        purpose: 'recommended',
        sourceText: '自由蓝调4件需自身强化特殊技命中，在效果持续期间降低同属性异常积蓄抗性。',
      },
    ],
  },
  'agent-koleda': {
    source: {
      id: 'miyoushe-qingfeng-koleda-potential-disc-78071412',
      url: 'https://www.miyoushe.com/zzz/article/78071412',
      author: 'HoYo青枫',
      sourceVersion: '3.2',
      reviewedForVersion: '3.3',
      pagePublishedAt: '09-10',
      pageUpdatedAt: '09-10',
      reviewedAt: '2026-11-02',
      observedAt: '2026-11-02',
      evidenceFile: 'miyoushe-78071412-review-excerpts.json',
      evidenceSha256: '38477db52c709ed65674570d7b1f8ad2211c786e8401a849c722287a3e2170e3',
      hashKind: 'manual_reviewed_excerpt_and_image_not_complete_dom',
    },
    minPotential: 1,
    planHints: ['搭配克拉蕾时可选'],
    plans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-proto-punk'],
        secondarySetIds: ['set-shockstar-disco'],
        purpose: 'conditional',
        sourceText: '搭配克拉蕾时可选；发动招架或回避支援后提升全队伤害。',
      },
    ],
  },
}

export function getReviewedWorkbenchDiscReference33(agentId: string, potential?: number | null) {
  const reference = currentGameDataSelection.gameVersion === '3.3' ? references[agentId] : undefined
  return reference &&
    (reference.minPotential === undefined ||
      (potential != null && potential >= reference.minPotential))
    ? reference
    : undefined
}
