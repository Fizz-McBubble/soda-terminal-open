import {
  type Current31StrengthGoldCase,
  guide,
  observed,
  mechanic,
  gold,
} from './current31StrengthGoldEvidence'

export const cases = [
  gold({
    caseId: 'gold-yixuan-dialyn-lucia-belion',
    split: 'calibration',
    memberIds: ['agent-yixuan', 'agent-dialyn', 'agent-lucia'],
    bangbooId: 'bangboo-belion',
    band: 'meta',
    evidenceRefs: [
      guide(
        'yixuan-teams',
        'Yixuan / Dialyn / Lucia is a recommended exact team; Belion is the stated best Bangboo.',
      ),
      observed('shiyu', 'Exact trio appears in 3.1.3 stage 5-2 and 5-3 observations.'),
      observed('deadly_assault', 'Exact trio appears in the 3.1.3 boss-1 observations.'),
    ],
    adjudication:
      '成熟命破队且跨模式出现，但当前 3.1 现实证据不支持把仪玄体系与本期 T0 核心强行同档；定为 Meta，不生成同档全序。',
  }),
  gold({
    caseId: 'gold-yixuan-ju-fufu-lucia-belion',
    split: 'independent_holdout',
    memberIds: ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'],
    bangbooId: 'bangboo-belion',
    band: 'meta',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/yixuan-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide(
        'yixuan-teams',
        'Yixuan / Ju Fufu / Lucia is a recommended exact team; Belion is the stated best Bangboo.',
      ),
      observed('shiyu', 'Exact trio appears in 3.1.3 stage 5-2 and 5-3 observations.'),
      observed('deadly_assault', 'Exact trio appears in the 3.1.3 boss-1 observations.'),
    ],
    adjudication:
      '精确替换 Variant 独立进入 Meta；不继承 Yixuan Family，也不使用 Dialyn Variant 的强度结果。',
  }),
  gold({
    caseId: 'gold-ye-dialyn-sunna-sprout',
    split: 'calibration',
    memberIds: ['agent-ye-shunguang', 'agent-dialyn', 'agent-sunna'],
    bangbooId: 'bangboo-sprout',
    band: 'apex',
    evidenceRefs: [
      guide(
        'ye-shunguang-teams',
        'Exact team is recommended; Sprout is the stated best Bangboo for Ye Shunguang.',
      ),
      observed('shiyu', 'Exact trio appears in 3.1.3 stage 5-2 and 5-3 observations.'),
      observed('deadly_assault', 'Exact trio appears in the 3.1.3 boss-3 observations.'),
    ],
    adjudication: '叶瞬光 T0 主核、Dialyn 与 Sunna 的机制闭合及跨模式高表现一致支持 Apex 粗档。',
  }),
  gold({
    caseId: 'gold-ye-dialyn-zhao-sprout',
    split: 'calibration',
    memberIds: ['agent-ye-shunguang', 'agent-dialyn', 'agent-zhao'],
    bangbooId: 'bangboo-sprout',
    band: 'apex',
    evidenceRefs: [
      guide(
        'ye-shunguang-teams',
        'Exact team is recommended; Sprout is the stated best Bangboo for Ye Shunguang.',
      ),
      observed('shiyu', 'Exact trio appears in 3.1.3 stage 5-2 and 5-3 observations.'),
      observed('deadly_assault', 'Exact trio appears in the 3.1.3 boss-3 observations.'),
    ],
    adjudication: '精确三人及芽芽均有具名依据，跨模式 Reality Check 支持 Apex。',
  }),
  gold({
    caseId: 'gold-ye-sunna-zhao-sprout',
    split: 'independent_holdout',
    memberIds: ['agent-ye-shunguang', 'agent-sunna', 'agent-zhao'],
    bangbooId: 'bangboo-sprout',
    band: 'apex',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/ye-shunguang-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide(
        'ye-shunguang-teams',
        'Exact team is recommended; Sprout is the stated best Bangboo for Ye Shunguang.',
      ),
      observed('shiyu', 'Exact trio appears across all three 3.1.3 Shiyu contexts.'),
      observed('deadly_assault', 'Exact trio is the highest-usage boss-3 observation.'),
    ],
    adjudication: '多场景稳定出现并与机制指南一致；作为 holdout，不允许运行时直接读取该标签。',
  }),
  gold({
    caseId: 'gold-aria-nangong-sunna-biggest-fan',
    split: 'calibration',
    memberIds: ['agent-aria', 'agent-nangong', 'agent-sunna'],
    bangbooId: 'bangboo-biggest-fan',
    band: 'apex',
    evidenceRefs: [
      guide(
        'aria-teams',
        'Exact team is recommended; Biggest Fan is recommended with Sunna and/or Nangong Yu.',
      ),
      guide(
        'deadly-assault',
        'Current recommended squad binds Aria / Nangong Yu / Sunna to Biggest Fan.',
      ),
      observed('shiyu', 'Exact trio appears in the 3.1.3 stage 5-2 observations.'),
    ],
    adjudication: 'T0 异常主核、最佳击破/支援搭配与精确邦布同时闭合，定为 Apex。',
  }),
  gold({
    caseId: 'gold-aria-nangong-yuzuha-biggest-fan',
    split: 'independent_holdout',
    memberIds: ['agent-aria', 'agent-nangong', 'agent-yuzuha'],
    bangbooId: 'bangboo-biggest-fan',
    band: 'apex',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/aria-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide('aria-teams', 'Exact team is recommended; Biggest Fan is recommended with Nangong Yu.'),
      observed('shiyu', 'Exact trio appears in the 3.1.3 stage 5-2 observations.'),
    ],
    adjudication:
      '同 Family 的柚叶 Variant 单独定档并进入 holdout；不得继承 Sunna Variant 的结果。',
  }),
  gold({
    caseId: 'gold-aria-sunna-yuzuha-biggest-fan',
    split: 'calibration',
    memberIds: ['agent-aria', 'agent-sunna', 'agent-yuzuha'],
    bangbooId: 'bangboo-biggest-fan',
    band: 'apex',
    evidenceRefs: [
      guide('aria-teams', 'Exact team is recommended; Biggest Fan is recommended with Sunna.'),
    ],
    adjudication:
      '三人均为当前异常体系核心位，精确组合与邦布关系明确；缺少同周期 Top-10 不解释为弱。',
  }),
  gold({
    caseId: 'gold-aria-remielle-velina-ariel',
    split: 'calibration',
    memberIds: ['agent-aria', 'agent-remielle', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    band: 'apex',
    evidenceRefs: [
      guide('aria-teams', 'Exact team is recommended for Version 3.1.'),
      guide('deadly-assault', 'Current recommended squad binds Aria / Remielle / Velina to Ariel.'),
      observed('shiyu', 'Exact trio appears in the 3.1.3 stage 5-1 observations.'),
      observed('deadly_assault', 'Exact trio is a leading 3.1.3 boss-2 observation.'),
    ],
    adjudication: '蕾米埃尔/维琳娜反应核心与爱芮高效异常输入形成当前 Apex 组合。',
  }),
  gold({
    caseId: 'gold-remielle-promeia-velina-ariel',
    split: 'calibration',
    memberIds: ['agent-remielle', 'agent-promeia', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    band: 'apex',
    evidenceRefs: [
      guide(
        'deadly-assault',
        'Current recommended squad binds Promeia / Velina / Remielle to Ariel.',
      ),
      observed('shiyu', 'Exact trio appears in the 3.1.3 stage 5-1 observations.'),
      observed('deadly_assault', 'Exact trio is a leading 3.1.3 boss-2 observation.'),
    ],
    adjudication: '精确队伍和艾瑞儿均由当前内容绑定，且双模式现实检查支持 Apex。',
  }),
  gold({
    caseId: 'gold-remielle-burnice-velina-ariel',
    split: 'independent_holdout',
    memberIds: ['agent-remielle', 'agent-burnice', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    band: 'apex',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/deadly-assault',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide(
        'deadly-assault',
        'Current recommended squad binds Burnice / Velina / Remielle to Ariel.',
      ),
      observed('shiyu', 'Exact trio appears in the 3.1.3 stage 5-1 observations.'),
      observed('deadly_assault', 'Exact trio is a leading 3.1.3 boss-2 observation.'),
    ],
    adjudication:
      'Burnice Variant 独立进入 holdout；不从 Remielle Family 或其他异常第三人继承档位。',
  }),
  gold({
    caseId: 'gold-sigrid-norma-sunna-ultra-jake',
    split: 'calibration',
    memberIds: ['agent-sigrid', 'agent-norma', 'agent-sunna'],
    bangbooId: 'bangboo-ultra-jake',
    band: 'apex',
    evidenceRefs: [
      guide(
        'sigrid-teams',
        'Exact team is recommended; Norma and Sunna are stated best partners and Ultra Jake the best Bangboo.',
      ),
    ],
    adjudication: 'T0 主核、最佳击破、最佳支援与专属邦布完整闭合；缺观测行不自动降档。',
  }),
  gold({
    caseId: 'gold-sigrid-norma-astra-ultra-jake',
    split: 'calibration',
    memberIds: ['agent-sigrid', 'agent-norma', 'agent-astra'],
    bangbooId: 'bangboo-ultra-jake',
    band: 'apex',
    evidenceRefs: [
      guide('sigrid-teams', 'Exact team is recommended; Ultra Jake is the stated best Bangboo.'),
      observed('shiyu', 'Exact trio appears in the 3.1.3 stage 5-3 observations.'),
      observed('deadly_assault', 'Exact trio appears in the 3.1.3 boss-1 observations.'),
    ],
    adjudication: 'Astra Variant 具名到精确邦布且跨模式出现，支持 Apex 粗档。',
  }),
  gold({
    caseId: 'gold-miyabi-nangong-yuzuha-biggest-fan',
    split: 'calibration',
    memberIds: ['agent-miyabi', 'agent-nangong', 'agent-yuzuha'],
    bangbooId: 'bangboo-biggest-fan',
    band: 'meta',
    evidenceRefs: [
      guide('hoshimi-miyabi-teams', 'Exact trio is described as Miyabi premiere DPS team.'),
      guide(
        'deadly-assault',
        'Current recommended squad binds Miyabi / Nangong Yu / Yuzuha to Biggest Fan.',
      ),
      observed('shiyu', 'Exact trio leads the 3.1.3 stage 5-3 observations.'),
      observed('deadly_assault', 'Exact trio leads the 3.1.3 boss-1 observations.'),
    ],
    adjudication: '成熟强队且现实表现稳定；当前角色版本定位低于本期 T0 Apex 核心，保守定为 Meta。',
  }),
  gold({
    caseId: 'gold-yixuan-lucia-astra-belion',
    split: 'calibration',
    memberIds: ['agent-yixuan', 'agent-lucia', 'agent-astra'],
    bangbooId: 'bangboo-belion',
    band: 'meta',
    evidenceRefs: [
      guide('yixuan-teams', 'Exact team is recommended; Belion is the stated best Bangboo.'),
      mechanic('belion-bangboo', 'Belion is the Rupture-oriented Bangboo used with Yixuan teams.'),
    ],
    adjudication:
      '仪玄与卢西娅保持命破核心，Astra 提供通用支援但不等同当前最佳专属第三人；定为 Meta。',
  }),
  gold({
    caseId: 'gold-yixuan-pulchra-lucia-belion',
    split: 'independent_holdout',
    memberIds: ['agent-yixuan', 'agent-pulchra', 'agent-lucia'],
    bangbooId: 'bangboo-belion',
    band: 'viable',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/yixuan-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide(
        'yixuan-teams',
        'Exact lower-cost team is recommended; Belion is the stated best Bangboo.',
      ),
      mechanic('belion-bangboo', 'Belion closes the Rupture Bangboo contract for the exact squad.'),
    ],
    adjudication:
      '低成本击破替换仍闭合命破循环，但控制、增伤与现实上限均低于 Dialyn/Ju Fufu 版本；定为 Viable。',
  }),
  gold({
    caseId: 'gold-ye-astra-zhao-sprout',
    split: 'calibration',
    memberIds: ['agent-ye-shunguang', 'agent-astra', 'agent-zhao'],
    bangbooId: 'bangboo-sprout',
    band: 'meta',
    evidenceRefs: [
      guide('ye-shunguang-teams', 'Exact team is recommended; Sprout is the stated best Bangboo.'),
      observed('shiyu', 'Exact trio appears in the 3.1.3 stage 5-2 observations.'),
      observed('deadly_assault', 'Exact trio appears in the 3.1.3 boss-3 observations.'),
    ],
    adjudication: '叶瞬光与照的核心循环成立，Astra 通用增益可用但弱于当前最佳专属衔接；定为 Meta。',
  }),
  gold({
    caseId: 'gold-ye-trigger-zhao-sprout',
    split: 'independent_holdout',
    memberIds: ['agent-ye-shunguang', 'agent-trigger', 'agent-zhao'],
    bangbooId: 'bangboo-sprout',
    band: 'viable',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/ye-shunguang-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide(
        'ye-shunguang-teams',
        'Exact substitute team is recommended; Sprout remains the best Bangboo.',
      ),
      observed(
        'deadly_assault',
        'Exact trio appears at the lower end of 3.1.3 boss-3 observations.',
      ),
    ],
    adjudication:
      '替代击破位可完成机制，但当前同场景现实表现与专属强队存在清晰距离；定为 Viable，不解释为不可用。',
  }),
  gold({
    caseId: 'gold-ye-seed-zhao-sprout',
    split: 'calibration',
    memberIds: ['agent-ye-shunguang', 'agent-seed', 'agent-zhao'],
    bangbooId: 'bangboo-sprout',
    band: 'viable',
    evidenceRefs: [
      guide(
        'ye-shunguang-teams',
        'Exact substitute team is recommended; Sprout is the stated best Bangboo.',
      ),
      mechanic('sprout-bangboo', 'Sprout supplies the named Yunkui Summit team contract.'),
    ],
    adjudication: 'Seed 能填补功能位但不是叶瞬光主流成熟循环的最佳击破/支援解；保留 Viable 粗档。',
  }),
  gold({
    caseId: 'gold-promeia-velina-yuzuha-ultra-jake',
    split: 'calibration',
    memberIds: ['agent-promeia', 'agent-velina', 'agent-yuzuha'],
    bangbooId: 'bangboo-ultra-jake',
    band: 'apex',
    evidenceRefs: [
      guide('velina-teams', 'Exact team is recommended and the Velina core synergy is explained.'),
      guide('deadly-assault', 'Current recommended squad binds the exact trio to Ultra Jake.'),
    ],
    adjudication: '当前 T0 异常主核、风异常副核与泛用异常支援闭合，并有精确邦布绑定；定为 Apex。',
  }),
  gold({
    caseId: 'gold-jane-vivian-yuzuha-robin',
    split: 'independent_holdout',
    memberIds: ['agent-jane', 'agent-vivian', 'agent-yuzuha'],
    bangbooId: 'bangboo-robin',
    band: 'meta',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/jane-doe-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide('jane-doe-teams', 'Exact team is recommended; Robin is stated best in a Vivian team.'),
      guide('deadly-assault', 'Current recommended squad binds the exact trio to Robin.'),
    ],
    adjudication:
      '成熟物理异常体系且邦布闭合，但当前主核版本位置低于本期 Apex 异常核心；定为 Meta。',
  }),
  gold({
    caseId: 'gold-alice-vivian-yuzuha-miss-esme',
    split: 'calibration',
    memberIds: ['agent-alice', 'agent-vivian', 'agent-yuzuha'],
    bangbooId: 'bangboo-miss-esme',
    band: 'meta',
    evidenceRefs: [
      guide(
        'alice-thymefield-teams',
        'Exact team is recommended; Miss Esme is Alice best Bangboo.',
      ),
      guide('deadly-assault', 'Current recommended squad binds the exact trio to Miss Esme.'),
      observed('shiyu', 'Exact trio appears in the 3.1.3 stage 5-2 observations.'),
    ],
    adjudication: '完整异常主核/后台伤害/支援结构且邦布明确；现实强度稳定但不升格为本期 Apex。',
  }),
  gold({
    caseId: 'gold-promeia-vivian-yuzuha-robin',
    split: 'calibration',
    memberIds: ['agent-promeia', 'agent-vivian', 'agent-yuzuha'],
    bangbooId: 'bangboo-robin',
    band: 'apex',
    evidenceRefs: [
      guide('deadly-assault', 'Current recommended squad binds the exact trio to Robin.'),
      mechanic(
        'vivian-teams',
        'Vivian and Yuzuha provide the documented off-field and support contract.',
      ),
    ],
    adjudication: '当前 T0 异常主核与成熟后台/支援组合闭合，精确邦布有当前模式推荐；定为 Apex。',
  }),
  gold({
    caseId: 'gold-remielle-jane-velina-ariel',
    split: 'independent_holdout',
    memberIds: ['agent-remielle', 'agent-jane', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    band: 'apex',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/jane-doe-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide('jane-doe-teams', 'Exact team is recommended for Patch 3.1.'),
      mechanic('ariel-bangboo', 'Ariel Additional Ability is explicitly activated by Remielle.'),
      observed('shiyu', 'Exact trio leads the 3.1.3 stage 5-1 observations.'),
      observed('deadly_assault', 'Exact trio leads the 3.1.3 boss-2 observations.'),
    ],
    adjudication: '双模式现实表现、三异常机制和 Remielle 专属邦布同时闭合；定为 Apex。',
  }),
  gold({
    caseId: 'gold-remielle-alice-velina-ariel',
    split: 'calibration',
    memberIds: ['agent-remielle', 'agent-alice', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    band: 'apex',
    evidenceRefs: [
      guide('alice-thymefield-teams', 'Exact team is recommended for Version 3.1.'),
      mechanic('ariel-bangboo', 'Ariel Additional Ability is explicitly activated by Remielle.'),
      observed('shiyu', 'Exact trio is a leading 3.1.3 stage 5-1 observation.'),
      observed('deadly_assault', 'Exact trio is a leading 3.1.3 boss-2 observation.'),
    ],
    adjudication: '三异常闭合、精确邦布有效且跨模式现实表现强；定为 Apex。',
  }),
  gold({
    caseId: 'gold-remielle-piper-velina-ariel',
    split: 'independent_holdout',
    memberIds: ['agent-remielle', 'agent-piper', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    band: 'meta',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/velina-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide('velina-teams', 'Exact team is recommended for Version 3.1.'),
      mechanic('ariel-bangboo', 'Ariel Additional Ability is explicitly activated by Remielle.'),
      observed('shiyu', 'Exact trio appears in 3.1.3 stage 5-1 observations.'),
      observed('deadly_assault', 'Exact trio appears in 3.1.3 boss-2 observations.'),
    ],
    adjudication:
      'Remielle/Velina 核心维持强度，但 A 级主核上限与现实排名低于 Apex 替换；定为 Meta。',
  }),
  gold({
    caseId: 'gold-remielle-vivian-velina-ariel',
    split: 'calibration',
    memberIds: ['agent-remielle', 'agent-vivian', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    band: 'apex',
    evidenceRefs: [
      guide('velina-teams', 'Exact team is recommended for Version 3.1.'),
      mechanic('ariel-bangboo', 'Ariel Additional Ability is explicitly activated by Remielle.'),
      mechanic('vivian-teams', 'Vivian provides the documented off-field Anomaly contract.'),
    ],
    adjudication: '三异常、后台伤害、风异常和 Remielle 专属邦布闭合；定为 Apex 粗档。',
  }),
  gold({
    caseId: 'gold-miyabi-vivian-yuzuha-robin',
    split: 'independent_holdout',
    memberIds: ['agent-miyabi', 'agent-vivian', 'agent-yuzuha'],
    bangbooId: 'bangboo-robin',
    band: 'meta',
    labelEvidenceRefs: [
      'https://www.icy-veins.com/zenless-zone-zero/hoshimi-miyabi-teams',
      'https://www.icy-veins.com/zenless-zone-zero/tier-list',
    ],
    evidenceRefs: [
      guide('hoshimi-miyabi-teams', 'Exact team is recommended for Patch 3.1.'),
      mechanic('vivian-teams', 'Robin is recommended with Vivian and the exact trio is listed.'),
      observed('shiyu', 'Exact trio appears in 3.1.3 stage 5-3 observations.'),
      observed('deadly_assault', 'Exact trio appears in 3.1.3 boss-1 observations.'),
    ],
    adjudication: '成熟紊乱循环与后台伤害成立，现实表现稳定；当前版本保守定为 Meta。',
  }),
  gold({
    caseId: 'gold-miyabi-yanagi-astra-agent-gulliver',
    split: 'calibration',
    memberIds: ['agent-miyabi', 'agent-yanagi', 'agent-astra'],
    bangbooId: 'bangboo-agent-gulliver',
    band: 'meta',
    evidenceRefs: [
      guide('hoshimi-miyabi-teams', 'Exact team is recommended for Patch 3.1.'),
      mechanic('agent-gulliver-bangboo', 'Two Section 6 members activate Agent Gulliver.'),
    ],
    adjudication:
      'Yanagi 的极性紊乱可持续供给落霜，Astra 提供通用增益，格列佛由双六课激活；定为 Meta。',
  }),
  gold({
    caseId: 'gold-miyabi-lycaon-soukaku-butler',
    split: 'calibration',
    memberIds: ['agent-miyabi', 'agent-lycaon', 'agent-soukaku'],
    bangbooId: 'bangboo-butler',
    band: 'viable',
    evidenceRefs: [
      guide(
        'hoshimi-miyabi-teams',
        'Exact low-spender team is recommended; Butler is the stated option.',
      ),
      mechanic(
        'von-lycaon-teams',
        'Lycaon and Soukaku supply the documented Ice burst support contract.',
      ),
    ],
    adjudication: '低成本冰队仍能闭合击破窗口和冰增益，但缺少当前异常体系资源上限；定为 Viable。',
  }),
] as const satisfies readonly Current31StrengthGoldCase[]
