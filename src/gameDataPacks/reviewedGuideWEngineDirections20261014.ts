import type { PlayerBuildField, PlayerBuildSource } from './playerBuildSources'

/** Exact archived alternatives; existing adopted source labels and order remain intact. */
export const reviewedGuideWEngineDirections20261014: Array<{
  agentId: string
  wengines: string[]
  conditions: string[]
  conditionsByValue?: Record<string, string[]>
  source: PlayerBuildSource
}> = [
  {
    agentId: 'agent-cissia',
    wengines: ['wengine-13111'],
    conditions: [
      '「旋钻机-赤轴」是原文明确的A级替代；先发动强化特殊技或连携技触发普攻电伤增益。原文单C与辅助方向分别讨论，不把来源列序当统一收益排名。',
    ],
    source: {
      id: 'miyoushe-74635375-wengine-fold-42-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/74635375',
      sourceVersion: '2.7',
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '41072f42955beffeef83ef77455407f6b5f27dc011b8e381e9e0798e2a327fd4',
      licenseBoundary:
        '既有208篇锁源复用；archiveSha256=501D5CF80819A44C16DBA945790C7AF96C4CE0B42F174EED93307845CB8F2E93；2723511 collection/post 74635375/structured_content op42 insert（backup_text/fold）unitRawSha256=41072f42955beffeef83ef77455407f6b5f27dc011b8e381e9e0798e2a327fd4。逐字段核对明确选项及条件，保留原版本，只补候选和条件，不删除既有选项，不作为当前最优或正式收益排序，不分发原文/图片。',
      verified: true,
    },
  },
  {
    agentId: 'agent-banyue',
    wengines: [],
    conditions: [
      '「燔火胧夜」仅在已高阶且不培养真斗时作为第三顺位参考；不加入无条件自动音擎列表。',
    ],
    source: {
      id: 'miyoushe-71526574-wengine-fold-42-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/71526574',
      sourceVersion: '2.4',
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '16ff284be08d4efd4ee0147cf46a1bbb879fc25e08aea0a8acf452956e802197',
      licenseBoundary:
        '既有208篇锁源复用；archiveSha256=501D5CF80819A44C16DBA945790C7AF96C4CE0B42F174EED93307845CB8F2E93；2723511 collection/post 71526574/structured_content op42 insert（backup_text/fold）unitRawSha256=16ff284be08d4efd4ee0147cf46a1bbb879fc25e08aea0a8acf452956e802197。逐字段核对明确选项及条件，保留原版本，只补候选和条件，不删除既有选项，不作为当前最优或正式收益排序，不分发原文/图片。',
      verified: true,
    },
  },
  {
    agentId: 'agent-ju-fufu',
    wengines: ['wengine-14110', 'wengine-13005'],
    conditions: [
      '「燃狱齿轮」的后台回能覆盖率随招式、开局能量和战斗时长变化；特殊连携及高速旋转处于场上，虎威自动攻击属于后台。',
      '「人为刀俎」需要先积攒并尽量保持较高能量；较低基础攻击力会提高达到3400攻击力目标的驱动盘需求。',
    ],
    source: {
      id: 'miyoushe-65745145-wengine-fold-46-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/65745145',
      sourceVersion: '2.0',
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '15166b754267b7abfd880eacafdd3dc0ad00a88edfc375f5166f0ab5bbdcc4c6',
      licenseBoundary:
        '既有208篇锁源复用；archiveSha256=501D5CF80819A44C16DBA945790C7AF96C4CE0B42F174EED93307845CB8F2E93；2723511 collection/post 65745145/structured_content op46 insert（backup_text/fold）unitRawSha256=15166b754267b7abfd880eacafdd3dc0ad00a88edfc375f5166f0ab5bbdcc4c6。逐字段核对明确选项及条件，保留原版本，只补候选和条件，不删除既有选项，不作为当前最优或正式收益排序，不分发原文/图片。',
      verified: true,
    },
  },
  {
    agentId: 'agent-vivian',
    wengines: ['wengine-13009'],
    conditions: [
      '「双生泣星」更适合长线高血量敌人，短战斗叠层少时表现下降；「触电唇彩」面对处于异常状态的敌人触发增益，原文明确为稳定A级替代。',
    ],
    source: {
      id: 'miyoushe-63809342-wengine-fold-46-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/63809342',
      sourceVersion: '1.7',
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '3f2583656c6a8c0380768c8e8e29d38eebafce7de25222ba3aa97329e0fa704f',
      licenseBoundary:
        '既有208篇锁源复用；archiveSha256=501D5CF80819A44C16DBA945790C7AF96C4CE0B42F174EED93307845CB8F2E93；2723511 collection/post 63809342/structured_content op46 insert（backup_text/fold）unitRawSha256=3f2583656c6a8c0380768c8e8e29d38eebafce7de25222ba3aa97329e0fa704f。逐字段核对明确选项及条件，保留原版本，只补候选和条件，不删除既有选项，不作为当前最优或正式收益排序，不分发原文/图片。',
      verified: true,
    },
  },
  {
    agentId: 'agent-yanagi',
    wengines: ['wengine-13009', 'wengine-13008'],
    conditions: [
      '「触电唇彩」需敌人处于异常状态并有启动时间；「双生泣星」适合精英或BOSS，增益持续至敌人从失衡恢复或死亡，打小怪相对一般。',
    ],
    source: {
      id: 'miyoushe-59165099-wengine-fold-50-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/59165099',
      sourceVersion: '1.3',
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '8bd3d9825eed85d6063d18be64755c7784652ca4893e9287a49deef6106c4083',
      licenseBoundary:
        '既有208篇锁源复用；archiveSha256=501D5CF80819A44C16DBA945790C7AF96C4CE0B42F174EED93307845CB8F2E93；2723511 collection/post 59165099/structured_content op50 insert（backup_text/fold）unitRawSha256=8bd3d9825eed85d6063d18be64755c7784652ca4893e9287a49deef6106c4083。逐字段核对明确选项及条件，保留原版本，只补候选和条件，不删除既有选项，不作为当前最优或正式收益排序，不分发原文/图片。',
      verified: true,
    },
  },
  {
    agentId: 'agent-banyue',
    wengines: ['wengine-13014'],
    conditions: [],
    conditionsByValue: {
      'wengine-13014': [
        '来源明确列为下位音擎；一般只获得两层贯穿力效果，不按满层全程比较。',
        '来源未保证全程两层或满层覆盖；具体层数仍按实际连携/终结技触发条件计算。',
      ],
    },
    source: {
      id: 'miyoushe-71704913-wengines-ops-228-233-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/71704913',
      sourceVersion: '2.4',
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '78a79027daca859e8ce8cb6eefa2adc4164e22294fab73f4a86e2392af508b33',
      verified: true,
      licenseBoundary:
        '既有锁源逐字段复用；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；post 71704913/structured_content ops[228:233) rawSha256=78a79027daca859e8ce8cb6eefa2adc4164e22294fab73f4a86e2392af508b33；textSha256=967df948a22a731192217fcb679fa14f13984060161fb3a5b1c0503ddf394529。仅原版本候选/历史参考，保留明确接受者及触发条件，不作当前收益排行或分发原文。',
    },
  },
  {
    agentId: 'agent-ju-fufu',
    wengines: ['wengine-13135'],
    conditions: [],
    conditionsByValue: {
      'wengine-13135': ['发动追加攻击后提高失衡值；原文未给确定收益或当前排名。'],
    },
    source: {
      id: 'miyoushe-65843423-wengine-fold-54-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/65843423',
      sourceVersion: null,
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '7106f24ec7a7e9f4c54dd0a131c0c42aeaee4fb09693f11a53c4ef658dc7e6a6',
      verified: true,
      licenseBoundary:
        '既有锁源post 65843423/structured_content op54 insert.fold及原图image_id=231499917交叉核对；unitRawSha256=7106f24ec7a7e9f4c54dd0a131c0c42aeaee4fb09693f11a53c4ef658dc7e6a6；imageSha256=3cf6efe111bcf70468881f2fab4d6ad197cd09928dba2044b776f0f72d80aa00；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；articleTitleVersion=2.0，图无独立版本。仅逐值候选及触发条件，不从A级推下位/首选，不分发原文或图。',
    },
  },
  {
    agentId: 'agent-ju-fufu',
    wengines: ['wengine-14003'],
    conditions: [],
    conditionsByValue: {
      'wengine-14003': ['月卡音擎；原文强化特殊技失衡通道，不推为统一下位或最佳。'],
    },
    source: {
      id: 'miyoushe-65843423-wengine-fold-55-reviewed-20261014',
      url: 'https://www.miyoushe.com/zzz/article/65843423',
      sourceVersion: null,
      checkedAt: '2026-10-14T00:00:00.000Z',
      contentHash: '53b5170b9dd0de0af96717bc8725b29b882ed5dbd72bb49a150f6db94baa10ff',
      verified: true,
      licenseBoundary:
        '既有锁源post 65843423/structured_content op55 insert.fold及原图image_id=231499917交叉核对；unitRawSha256=53b5170b9dd0de0af96717bc8725b29b882ed5dbd72bb49a150f6db94baa10ff；imageSha256=3cf6efe111bcf70468881f2fab4d6ad197cd09928dba2044b776f0f72d80aa00；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；articleTitleVersion=2.0，图无独立版本。仅逐值候选及触发条件，不从A级推下位/首选，不分发原文或图。',
    },
  },
]

export function supplementReviewedGuideWEngineDirections(
  agentId: string,
  field: PlayerBuildField,
): PlayerBuildField {
  const supplements = reviewedGuideWEngineDirections20261014.filter(
    (entry) => entry.agentId === agentId && entry.wengines.length,
  )
  if (!supplements.length || !Array.isArray(field.value)) return field
  return supplements.reduce((current, supplement) => {
    if (!Array.isArray(current.value)) return current
    const originalValues = current.value.filter(
      (value): value is string => typeof value === 'string',
    )
    const addedValues = supplement.wengines.filter((value) => !originalValues.includes(value))
    if (!addedValues.length) return current
    return {
      ...current,
      value: [...new Set([...originalValues, ...addedValues])],
      sourceValues: current.sourceValues ?? originalValues,
      supplementalSources: [
        ...(current.supplementalSources ?? []),
        {
          source: supplement.source,
          values: addedValues,
          ...(supplement.conditionsByValue
            ? { conditionsByValue: supplement.conditionsByValue }
            : {}),
        },
      ],
    }
  }, field)
}
