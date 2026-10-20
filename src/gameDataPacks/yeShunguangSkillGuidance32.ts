import type { PlayerBuildSource } from './playerBuildSources'

/** Reused native V3.0 image targets. A minimum is not a paid cap or an ordered rotation. */
export const yeShunguangSkillGuidance32 = {
  directions: ['核心技优先升至 F', '普攻 11+', '闪避 9+', '支援技 9+', '特殊技 11+', '终结技 11+'],
  source: {
    id: 'miyoushe-76034445-ye-skill-minima-core-f',
    url: 'https://www.miyoushe.com/zzz/article/76034445',
    sourceVersion: '3.0',
    originalSourceVersion: '3.0',
    authorReviewedVersion: '3.0',
    checkedAt: '2026-10-19T00:00:00.000Z',
    contentHash: '146bb958dc340000213c6480ee0ac8633b6cf67edba03961ab026f70d7a0cdf5',
    verified: true,
    licenseBoundary:
      '复用已归档76034445原图002技能加点区（normalized XYXY0.075,0.18,0.935,0.28）；图示适用V3.0，仅核心F标注优先，五项战斗技均为带+的等级下限，不将图标顺序当投入顺序，不推断原图付费基础等级或影画。当前3.2仅复核具名合光核心组件，不声明作者已复审完整构筑/投入排序；不分发原图。',
  } satisfies PlayerBuildSource,
  authorTargets: {
    core: { target: 'F', level: 7, priority: true, levelBasis: 'core_no_mindscape_bonus' },
    combatTargetKind: 'minimum_reference' as const,
    combatSourceLevelBasis: 'image_displayed_unspecified_paid_vs_effective' as const,
    combatPriorityOrder: null,
  },
  currentComponentReview: {
    targetVersion: '3.2',
    scope: 'named_unity_core_components_only',
    reviewedAt: '2026-10-19',
    repository: 'https://github.com/frzyc/genshin-optimizer',
    commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
    stats: {
      path: 'libs/zzz/stats/Data/Characters/YeShunguang.json',
      sha256: '99342202B3CD34C9BE1AAC5E15E85F394019AE15D33C442230187A43B3D20BA5',
      locators: ['coreParams/4/0..6', 'coreParams/5/0..6'],
    },
    localization: {
      path: 'libs/zzz/dm-localization/assets/locales/en/char_YeShunguang_gen.json',
      sha256: 'E6B9F09FD78573BF27CF6877AE30BE679CA99311CD3D769BEFA686BD71D513ED',
      locator: 'core/desc/0..6/1',
    },
    effectIds: ['reviewed_unity_crit32', 'reviewed_unity_damage32'],
    condition: '进入战场获得合光；仅在该具名状态有效且其余输入相同时核对核心等级成长。',
    conclusion: '核心F提高这两个当前组件；不据此计算全循环、升级资源回报或战斗技优先序。',
    currentWholeBuildPriorityReviewed: false,
  },
}
