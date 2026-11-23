import { teamOutputModules } from './teamOutputModuleContract'
import type { ReviewedTeamOutputModuleEvidence } from './reviewedTeamOutputModuleEvidence'
import type { ReviewedTeamSourceDirection } from './reviewedTeamSourceDirectionTypes'

const gameVersion = '3.3'
const checkedAt = '2026-11-22'
const memberIds = ['agent-severian', 'agent-norma', 'agent-astra'] as const

const officialMembership = {
  id: 'hoyolab-47327352-severian-norma-astra',
  url: 'https://www.hoyolab.com/article/47327352',
  sourceVersion: gameVersion,
  sourceUpdatedAt: '2026-11-05',
  checkedAt,
  contentHash: '59136b52a5e945a79bc77de42874890934078680cc9beda6d1e5174beba6c4aa',
  hashDefinition: 'official CDN response bytes',
  locator: 'structured_content/op/5/insert/image; Recommended Team Compositions, row 1',
  imageEvidence: {
    imageSha256: '59136b52a5e945a79bc77de42874890934078680cc9beda6d1e5174beba6c4aa',
    region: 'x=108..984; y=897..1103; source=1080x1810',
  },
  verificationStatus: 'reviewed_exact_team_current_33',
}

const releasedMechanicReview = {
  id: 'hoyobuild-norma-33-severian-astra',
  url: 'https://hoyobuild.com/en/zzz/characters/norma',
  sourceVersion: gameVersion,
  sourceUpdatedAt: '2026-11-15',
  checkedAt,
  contentHash: 'a551acbdc5c50626d6acae4327501cb2d8fc545dcf42730f0be7f4d5444f24ef',
  hashDefinition: 'released guide HTML response bytes',
  locator: 'Teams > Recommended teams > Wind Attack: Severian & Astra Yao',
  verificationStatus: 'reviewed_exact_team_current_33',
}

const conditions = [
  '诺姆在后台积累失衡和创造连携机会，赛维里安通过连携补充流息，以苍风影猎打风属性直伤。',
  '耀嘉音通过快速支援衔接增益。失衡窗口和资源覆盖取决于实际操作。',
]

export const reviewedSeverianTeamOutput33 = {
  memberIds,
  classification: 'current_exact_team_review',
  module: teamOutputModules.directStun,
  sourceEvidence: [
    {
      sourceId: officialMembership.id,
      sourceVersion: gameVersion,
      contentHash: officialMembership.contentHash,
      locator: officialMembership.locator,
      text: '官方机制介绍的第一支示例队列出赛维里安、诺姆和耀嘉音。',
    },
    {
      sourceId: releasedMechanicReview.id,
      sourceVersion: gameVersion,
      contentHash: releasedMechanicReview.contentHash,
      locator: releasedMechanicReview.locator,
      text: conditions.join(' '),
    },
  ],
} as const satisfies ReviewedTeamOutputModuleEvidence

/** Discovery evidence for an exact released trio. */
export function reviewedSeverianSourceDirections33(version: string): ReviewedTeamSourceDirection[] {
  if (version !== gameVersion) return []
  return [
    {
      memberIds,
      sourceRefs: [officialMembership, releasedMechanicReview],
      conditions: [...conditions],
      conditionsBySourceId: {
        [officialMembership.id]: [],
        [releasedMechanicReview.id]: conditions,
      },
    },
  ]
}
