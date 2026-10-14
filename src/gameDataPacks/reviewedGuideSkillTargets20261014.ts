import type { PlayerBuildField, PlayerBuildSource } from './playerBuildSources'

/** Numeric bounds supplement existing priority prose without transferring its authorship. */
export const reviewedGuideSkillTargets20261014: Array<{
  agentId: string
  directions: string[]
  source: PlayerBuildSource
}> = [
  {
    agentId: 'agent-yanagi',
    directions: ['普攻 7+', '闪避 7+', '支援技 9+', '特殊技 12+', '终结技 11+', '核心技 F'],
    source: {
      id: 'miyoushe-59164221-skills-image-227030909-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/59164221',
      sourceVersion: null,
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: 'f44be998710ded0cbc35ca6faa76d86ef2c47d8999de4f486297f2d755a199d4',
      verified: true,
      licenseBoundary:
        '既有锁源原图视觉复核；collection 2716049/post 59164221/image_id=227030909；imageSha256=f44be998710ded0cbc35ca6faa76d86ef2c47d8999de4f486297f2d755a199d4；archiveSha256=5ed94053d19bd1d3aff6b944a534998a9a1d64d7568ee6d1589d050a0d46097e；articleTitleVersion=1.3，原图无独立版本标记，因此sourceVersion=null。仅采用五战斗技下限及MAX核心目标F，不从数值/颜色推优先；原件保留私有F缓存，不再分发。',
    },
  },
  {
    agentId: 'agent-ju-fufu',
    directions: ['普攻 11+', '闪避 7+', '支援技 9+', '特殊技 11+', '终结技 11+', '核心技 F'],
    source: {
      id: 'miyoushe-65745091-skills-image-241459429-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/65745091',
      sourceVersion: null,
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '22f07c56091fe07461e578c8225df3b6a140060d43f03898a49e83a4f89434a5',
      verified: true,
      licenseBoundary:
        '既有锁源原图视觉复核；collection 2716049/post 65745091/image_id=241459429；imageSha256=22f07c56091fe07461e578c8225df3b6a140060d43f03898a49e83a4f89434a5；archiveSha256=5ed94053d19bd1d3aff6b944a534998a9a1d64d7568ee6d1589d050a0d46097e；articleTitleVersion=2.0，原图无独立版本标记，因此sourceVersion=null。仅采用五战斗技下限及MAX核心目标F，不从数值/颜色推优先；原件保留私有F缓存，不再分发。',
    },
  },
]

export function supplementReviewedGuideSkillTargets(
  agentId: string,
  field: PlayerBuildField,
): PlayerBuildField {
  const supplement = reviewedGuideSkillTargets20261014.find((entry) => entry.agentId === agentId)
  if (!supplement || !Array.isArray(field.value)) return field
  const values = field.value.filter((value): value is string => typeof value === 'string')
  // Existing explicit levels require a source-selection decision; never silently takeHigher.
  if (
    values.some((value) =>
      /^(普通攻击|普攻|闪避|支援技|特殊技|终结技|连携技|核心技)\s*(?:优先升至\s*)?(F|(?:1[0-5]|[1-9])\+?)$/.test(
        value,
      ),
    )
  )
    return field
  return {
    ...field,
    value: [...values, ...supplement.directions],
    sourceValues: field.sourceValues ?? values,
    supplementalSources: [
      ...(field.supplementalSources ?? []),
      { source: supplement.source, values: supplement.directions },
    ],
  }
}
