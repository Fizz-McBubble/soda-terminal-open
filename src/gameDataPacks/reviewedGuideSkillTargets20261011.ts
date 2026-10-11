import type { PlayerBuildSource } from './playerBuildProfiles'

/** Reviewed skill-panel lower bounds; original guide versions and image bytes are retained. */
export const reviewedGuideSkillTargets20261011: Partial<
  Record<string, { directions: string[]; source: PlayerBuildSource }>
> = Object.fromEntries(
  [
    {
      id: 'agent-alice',
      post: '67197387',
      version: '2.1',
      hash: 'CEDD639611298882E8A960721BC3D0F719501FA8DA9CFA85A14D973BE40A4FFB',
      directions: ['普攻 9+', '闪避 7+', '支援技 7+', '特殊技 9+', '终结技 9+', '核心技优先升至 F'],
    },
    {
      id: 'agent-vivian',
      post: '63809342',
      version: '1.7',
      hash: '497205F8BA7987ABE99AEDD5892E572125A5CA66D8CF992DD6C405751E2BBE9A',
      directions: ['普攻 9+', '闪避 7+', '支援技 9+', '特殊技 9+', '终结技 9+', '核心技优先升至 F'],
    },
    {
      id: 'agent-yuzuha',
      post: '66458093',
      version: '2.1',
      hash: '60B36EAB74D9007F56D784C264E30EBDC5B920517B72C021AC43EA44F2F5F353',
      directions: [
        '普攻 11+',
        '闪避 7+',
        '支援技 9+',
        '特殊技 11+',
        '终结技 11+',
        '核心技优先升至 F',
      ],
    },
    {
      id: 'agent-burnice',
      post: '58606692',
      version: '1.2',
      hash: '32A6DA425B02D921E75D38D110D290A674F5AA35C0E23A675B9B7961A9A0F331',
      // The image omits core; the archived prose supplies only core-first priority, not a level.
      directions: [
        '核心技优先升级',
        '普攻 7+',
        '闪避 7+',
        '支援技 7+',
        '特殊技优先升至 9+',
        '连携技 7+',
      ],
    },
  ].map(({ id, post, version, hash, directions }) => [
    id,
    {
      directions,
      source: {
        id: `miyoushe-post-${post}-skills-image-002-reviewed-20261011`,
        url: `https://www.miyoushe.com/zzz/article/${post}`,
        sourceVersion: version,
        checkedAt: '2026-10-11T00:00:00.000Z',
        contentHash: hash,
        licenseBoundary:
          '已归档攻略定位的第二张养成图经视觉复核；仅采用技能等级下限和明确优先标记。柏妮思图片不含核心等级，核心优先只复用同帖原文，不补推核心目标。保留原版本，不声称当前版本最优，不分发原图。',
        verified: true,
      },
    },
  ]),
)
