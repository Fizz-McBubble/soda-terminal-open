import type { PlayerBuildSource } from './playerBuildProfiles'

export type PotentialGuideReference = {
  kind: 'historical_potential_skill_reference'
  requiredPotentialImage: 6
  skillDirections: string[]
  automaticApplication: false
}

/** Reviewed guide facts, never evidence that the account has activated potential. */
export const reviewedPotentialGuideReferences: Partial<
  Record<
    string,
    {
      value: PotentialGuideReference
      source: PlayerBuildSource
    }
  >
> = Object.fromEntries(
  [
    {
      id: 'agent-grace',
      post: '72000935',
      image: '245313944',
      version: '2.5',
      hash: 'A2A1500E7195515AB029C46BA1478BEFCBFEDC21B3C3BB6C53171329FA543275',
      skills: ['普攻 7+', '闪避 7+', '支援技 7+', '特殊技 12+', '终结技 10+', '核心技 F'],
    },
    {
      id: 'agent-harumasa',
      post: '60270933',
      image: '247890678',
      version: '1.4',
      hash: 'C90C4E72133A8B071E062C1E134E8762BDF01FD86C39AE60A47C1EB936A30ACF',
      skills: ['普攻 10+', '闪避 12+', '支援技 7+', '特殊技 11+', '终结技 11+', '核心技 F'],
    },
  ].map(({ id, post, image, version, hash, skills }) => [
    id,
    {
      value: {
        kind: 'historical_potential_skill_reference',
        requiredPotentialImage: 6,
        skillDirections: skills,
        automaticApplication: false,
      },
      source: {
        id: `miyoushe-post-${post}-potential-image-${image}`,
        url: `https://www.miyoushe.com/zzz/article/${post}`,
        sourceVersion: version,
        checkedAt: '2026-09-07T15:40:00.000Z',
        contentHash: hash,
        licenseBoundary:
          'API与原图技能区复核：明确潜能ON、6/6；仅条件等级参考，不推导优先级、账户激活或当前版本最优。版本是原帖归档标签，非修订图片适用版本；不分发原图。',
        verified: true,
      },
    },
  ]),
)

export function isPotentialGuideReference(value: unknown): value is PotentialGuideReference {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PotentialGuideReference>
  return (
    item.kind === 'historical_potential_skill_reference' &&
    item.requiredPotentialImage === 6 &&
    item.automaticApplication === false &&
    Array.isArray(item.skillDirections) &&
    item.skillDirections.length > 0 &&
    item.skillDirections.every((text) => typeof text === 'string')
  )
}
