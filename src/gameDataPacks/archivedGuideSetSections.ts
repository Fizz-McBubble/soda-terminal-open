import { agentCatalog } from '../assault/catalogData'
import { compileCandidateSetPlans } from './candidateSetPlans'
import type { PlayerBuildSource } from './playerBuildProfiles'

// Field-only evidence from archived full text or individually reviewed images.
// Image evidence is identified separately; the short content preview is not used.
const sections = [
  {
    name: '格莉丝',
    postId: '56349316',
    version: '1.0',
    hash: '613EC64A4E617686BEA522B7E759E7FFA8AC1E60245FF25D5CFF48A82BED2B54',
    // The image was revised on 2025-04-24, but remains a historical 1.0 guide.
    // It is deliberately not read as a current-version or full-post recommendation.
    directions: [
      '雷暴重金属 4 件 + 自由蓝调 2 件（历史攻略参考：需要感电覆盖，当前尚未核验触发条件，仅保留来源参考）',
      '自由蓝调 4 件 + 雷暴重金属 2 件（历史攻略参考）',
    ],
  },
  {
    name: '柏妮思',
    postId: '58606692',
    version: '1.2',
    hash: 'E0DD387DA0AADCC8CEA28A30B468AF1A8501538A5C215B037CD94C002BC2AC80',
    text: '自由蓝调4件不做首选，表现力要低于混沌爵士；考虑覆盖率时，该4件套低于混沌4在6%左右。2件套主要是自由2、摇摆2、炎狱2。异常/紊乱伤害上自由2件更为优秀，炎狱兼具强化E直伤输出，摇摆2对循环的优化更好；没有专武时推荐考虑摇摆2件。',
    // Existing primary-field evidence also names Chaos Jazz 4; retain each
    // archived secondary branch's use case rather than merging its conditions.
    directions: [
      '混沌爵士 4 件 + 自由蓝调 2 件（1.2版攻略参考：侧重异常/紊乱伤害）',
      '混沌爵士 4 件 + 摇摆爵士 2 件（1.2版攻略参考：优化循环，无专武时可考虑）',
      '混沌爵士 4 件 + 炎狱重金属 2 件（1.2版攻略参考：兼顾强化特殊技直伤）',
    ],
  },
  {
    name: '般岳',
    postId: '71526574',
    version: '2.4',
    hash: 'F65AD6EDA9B4C10757C7A61A27C2082EF0783D513C2F14953F5BBA7914AB5E72',
    text: '①【云岿如我】是毋庸置疑的毕业套装，散搭2+2+2仅推荐过渡。\n② 云岿4件的“10%贯穿增伤”为贯穿力增伤区、并非传统增伤区。\n③ 2件套优选折枝剑歌、啄木鸟电音中考虑，有词条优秀的炎狱2件也可选择。',
    // Reviewed expansion of source abbreviations; keep the conditional option separate.
    directions: [
      '云岿如我 4 件 + 折枝剑歌 / 啄木鸟电音 2 件',
      '云岿如我 4 件 + 炎狱重金属 2 件（副词条优秀时可选）',
    ],
  },
  {
    name: '伊芙琳',
    postId: '61946271',
    version: '1.5',
    hash: 'A95952A07E4FA21CDDCB1F094B8CAE864FF8B0D063E63F2B72F3725870FB31BD',
    text: '① 目前并没有特别契合伊芙琳机制的4件套，所以选择副词条优秀的散搭也是一种选择。\n③ 通常优选【炎狱2+折剑2+啄木鸟2】。',
    directions: [
      '炎狱重金属 2 件 + 折枝剑歌 2 件 + 啄木鸟电音 2 件（副词条优秀的散搭；1.5版参考）',
    ],
  },
  {
    name: '星徽·比利',
    postId: '75676616',
    version: '2.8',
    hash: 'D0B69F78D8836689E6338018C226C0866A1E260C67F43A302247C3DE3A820DF8',
    text: '●4件套选择【云岿如我】\n»2件套提供了生命值加成，4件套提供了12%的暴击加成\n»2件套选择就比较多了：\n［折枝剑歌］提供了暴击伤害加成\n［啄木鸟电音］提供暴击率加成',
  },
  {
    name: '南宫羽',
    postId: '74153268',
    version: '2.7',
    hash: 'A3F7837D281AF76D505AAB746429078E0F82ECBD9D6407DFD55C410A9DEDA961',
    text: '●4件套选择【法厄同之歌】\n»2件套提供了异常掌控加成，4件套提供了异常精通和增伤加成\n（适合爱芮队伍使用）\n»这种情况下2件套可以选择选择：\n［自由蓝调］/［混沌爵士］提供异常精通加成\n\n●4件套也可以选择【静听嘉音】\n»4件套可以通过快速支援叠加增伤效果\n（适合其余异常队伍，需要搭配支援位使用，例如：雅南柚）\n»这种情况下2件套选择就一种：\n［法厄同之歌］提供了8%的异常掌控加成',
  },
]

export function compileArchivedGuideSetSection(text: string): string[] {
  return text.split(/(?=●4件套)/).flatMap((branch) => {
    const primary = /●4件套[^\n【]*【([^】]+)】/.exec(branch)?.[1]
    const choice = /2件套[^\n：:]*选择[^\n：:]*[：:]([\s\S]*)/.exec(branch)?.[1]
    if (!primary || !choice) return []
    const secondary = [...choice.matchAll(/［([^］]+)］/g)].map((match) => match[1])
    if (!secondary.length) return []
    const conditions = [...branch.matchAll(/（([^）]+)）/g)].map((match) => match[1])
    const direction = `${primary} 4 件 + ${secondary.join(' / ')} 2 件${conditions.length ? `（${conditions.join('；')}）` : ''}`
    return compileCandidateSetPlans([direction]).length ? [direction] : []
  })
}

export function getArchivedGuideSetDirections(
  agentId: string,
): { sets: string[]; source: PlayerBuildSource } | null {
  const agent = agentCatalog.find((item) => item[0] === agentId)
  const section = sections.find((item) => item.name === agent?.[1])
  if (!section) return null
  return {
    sets: section.directions ?? compileArchivedGuideSetSection(section.text),
    source: {
      id:
        section.postId === '56349316'
          ? 'miyoushe-post-56349316-image-226493258-disc-section'
          : `miyoushe-post-${section.postId}-structured-disc-section`,
      url: `https://www.miyoushe.com/zzz/article/${section.postId}`,
      sourceVersion: section.version,
      checkedAt: '2026-09-07T00:00:00.000Z',
      contentHash: section.hash,
      licenseBoundary:
        section.postId === '56349316'
          ? '已有归档图片（226493258）驱动盘信息，非全文内容；历史1.0版攻略候选参考，图片2025-04-24修订并于2026-09-07复核，未声称3.1最优；不分发原图。'
          : `已有归档 structured_content 驱动盘段落；${section.version}版攻略候选参考，保留原队伍条件，未声称3.1最优；不分发原图。`,
      verified: true,
    },
  }
}

/** Source-complete historical references, not automatically eligible solver alternatives. */
const reviewedSetSupplements: Partial<
  Record<
    string,
    { sets: string[]; source: PlayerBuildSource; additionalSources?: PlayerBuildSource[] }
  >
> = {
  'agent-evelyn': {
    sets: [
      '激素朋克 4 件 + 河豚电音 2 件（2025-10-31更新攻略参考：入场攻击增益需覆盖爆发窗口，不能假设全程生效）',
      '河豚电音 4 件 + 折枝剑歌 2 件（2025-10-31更新攻略参考：发动终结技后利用攻击增益窗口）',
      '激素朋克 2 件 + 河豚电音 2 件 + 啄木鸟电音 2 件（2025-10-31更新攻略参考：按实际散件词条质量考虑，非同面板已证优选）',
      '啄木鸟电音 4 件 + 折枝剑歌 2 件（原图明确适用V1.5：普攻、闪避反击、强化特殊技独立叠层，长失衡期间难维持满层）',
    ],
    source: {
      id: 'miyoushe-61945825-revised-evelyn-disc-reference',
      url: 'https://www.miyoushe.com/zzz/article/61945825',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '1CAC62718CAA0E5F1FAC2CDFA1B9F2C533BF43B84FC738CFC617EBBA27981B20',
      licenseBoundary:
        '前三条参考来自61945825原图239036059及正文：图上传2025-09-27、文章updatedAt=2025-10-31T11:25:20Z，标题1.5不代表修订字段版本，未标独立适用版本。archiveSha256=5ed94053d19bd1d3aff6b944a534998a9a1d64d7568ee6d1589d050a0d46097e；bodySha256=85bd56f01b2bb6d006348e5eb629dbb67ef37ed23f339fa32ad0b2f61dbc8544；UTF16 4027:4223，spanSha256=a4aed6e901c4fb2d9badbbb12dace96f2aa663d3fc789601c8de37f53a20a9f9。仅可读历史条件参考，非3.1最优，不扩自动配装，不分发原图。第四条独立来源见additionalSources。',
      verified: true,
    },
    additionalSources: [
      {
        id: 'miyoushe-61946271-image-220684507-evelyn-woodpecker-reference',
        url: 'https://www.miyoushe.com/zzz/article/61946271',
        sourceVersion: '1.5',
        checkedAt: '2026-09-10T00:00:00.000Z',
        contentHash: 'E4FDFCE3CB621EC2B640D9463519CF5E99FB97D76C20093BB7044C6C8B4E07BF',
        licenseBoundary:
          '仅第四条啄木鸟4+折枝2来自原图220684507方案1，图内明确适用V1.5；文章updatedAt=2026-01-18T05:41:53Z不等于该图当前最优。op51独立叠层与失衡覆盖条件，unitRawSha256=8ab3d654b954b1387ac7978cf4f11793cd72dd1e8f3c58b1d0e36a6f06885c62；archiveSha256=501d5cf80819a44c16dba945790c7af96c4ce0b42f174eed93307845cb8f2e93。仅历史条件参考，不修改当前散搭、评分或自动候选；不分发原图。',
        verified: true,
      },
    ],
  },
  'agent-yuzuha': {
    sets: [
      '摇摆爵士 4 件 + 法厄同之歌 2 件（2025年发布攻略参考：发动连携技或终结技后提供全队增伤）',
      '原始朋克 4 件 + 法厄同之歌 2 件（2025年发布攻略参考：通过招架支援触发全队增伤）',
    ],
    source: {
      id: 'miyoushe-66558093-reviewed-final-fold-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/66558093',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '9e5fd8f88f0a5cf6577203c86b5d2b9d32fceaac697952e241d8484908641ee6',
      licenseBoundary:
        '2025年发布原帖的已归档独立配盘段落，未标独立适用版本；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op63 unitRawSha256=c7e1b7075c83f221c7232643d2aaf690949e55c1acdad0171624a7ee3eec7eb5；op64 unitRawSha256=2306bd677f1aa320e69468a7e2c6adf7c76721e8542d4f0d20deda0dbf1260d2。仅追加带条件的历史来源分支，保留当前默认、排序和权重，不分发原图。',
      verified: true,
    },
  },
  'agent-seth': {
    sets: [
      '静听嘉音 4 件 + 原始朋克 / 激素朋克 2 件（2025年发布攻略参考：通过快速支援提供增伤，副套侧重护盾量）',
    ],
    source: {
      id: 'miyoushe-67460846-reviewed-final-fold-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/67460846',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: 'f8f44f06dbf31209355e00b85fc654e1e130101d9ca114811cd63d63f670553f',
      licenseBoundary:
        '2025年发布原帖的已归档独立配盘段落，未标独立适用版本；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op53 unitRawSha256=efe14768b789a862e929091d7121cebb3c4de0882f30943f16d4cd70f13b31f1。仅追加带条件的历史来源分支，保留当前默认、排序和权重，不分发原图。',
      verified: true,
    },
  },
  'agent-dialyn': {
    sets: [
      '山大王 4 件 + 震星迪斯科 / 啄木鸟电音 / 月光骑士颂 / 摇摆爵士 2 件（2025年发布攻略参考：暴击率要求100%，副套按暴击、冲击或回能需求选择）',
    ],
    source: {
      id: 'miyoushe-70997991-reviewed-final-fold-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/70997991',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '7cbf5fcd0149af68ba865d4a9ea2cd90deca3fc6bd4bdbece0a4d77a6bacbf97',
      licenseBoundary:
        '2025年发布原帖的已归档独立配盘段落，未标独立适用版本；archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op64 unitRawSha256=90dbb7ea3a8de849753e09ec9b3b75eac609118227650ea50dcaa4ac470127ab。仅追加带条件的历史来源分支，保留当前默认、排序和权重，不分发原图。',
      verified: true,
    },
  },
  'agent-lucia': {
    sets: [
      '月光骑士颂 4 件 + 摇摆爵士 2 件（2.3版攻略参考：使用铸梦炉歌且生命值已满足目标时，补充回能）',
    ],
    source: {
      id: 'miyoushe-69626706-disc-conditional-secondary',
      url: 'https://www.miyoushe.com/zzz/article/69626706',
      sourceVersion: '2.3',
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '868f657c3eb5be4dd93a5a00ad697949f93ab19c5ceca1a2953782815744266b',
      licenseBoundary:
        '既有归档正文配盘段；bodySha256=1b1adfacb2ca8726b97514eb8fec49d57b18608790d2f0ebdabe448cb881a969；UTF-16 span4031:4119。只追加有专武且生命条件满足时的副套，不变月光4云岿2默认、目标区间或权重。',
      verified: true,
    },
  },
  'agent-ellen': {
    sets: [
      '极地重金属 4 件 + 啄木鸟电音 / 折枝剑歌 / 河豚电音 2 件（2025年发布攻略参考：搭配莱卡恩或苍角可较快施加冻结、碎冰）',
      '啄木鸟电音 4 件 + 极地重金属 2 件（2025年发布攻略参考：队伍仅艾莲一名冰属性角色时可用）',
    ],
    source: {
      id: 'miyoushe-65170849-nested-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/65170849',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '98f25ebcef3793f50e605471c3190ace6e635e626dc39cf42de5aa5f85943ccb',
      licenseBoundary:
        '2025年发布原帖中的已归档独立配盘段落；原帖标题：【2.0攻略征集】艾莲·乔 角色玩法介绍。段落自身未标注版本，标题不作为当前适用版本。archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op64 insert.fold unitRawSha256=eea1a5461a6c6d95814adbb2aef670fd5f9e4a220a993d61cb054ffdb6197d74；op65 insert.fold unitRawSha256=f81dfca727d0c04ac6ab16a7efe9b6ebe815c368ffa469f14f9cb8a002e801d3。仅追加历史条件分支，保留现有默认，不新增权重、强度或账户数据。',
      verified: true,
    },
  },
  'agent-nicole': {
    sets: [
      '月光骑士颂 4 件 + 摇摆爵士 / 混沌重金属 / 自由蓝调 2 件（2025年发布攻略参考：优先保证回能，回能够用后可选伤害副套）',
      '自由蓝调 4 件 + 摇摆爵士 / 月光骑士颂 / 法厄同之歌 2 件（2025年发布攻略参考：用于异常队打紊乱；回能够用后可选法厄同提高积蓄效率）',
    ],
    source: {
      id: 'miyoushe-68488252-nested-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/68488252',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '29dddc36e2ec289eb484d40f03309ed845496d40c6154d4e9513e1cb0211d194',
      licenseBoundary:
        '2025年发布原帖中的已归档独立配盘段落；原帖标题：【2.2攻略征集】妮可 角色玩法介绍。段落自身未标注版本，标题不作为当前适用版本。archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op53 insert.fold unitRawSha256=6728f1e81a48852ef1a4e430336a4cd12f0233490b7efb2a400d0e3fa9b7fa38；op54 insert.fold unitRawSha256=99c9dfb2c92f12449d2cebef43d0a5e6e9018611fff93ef3f27706b03ab89e5a。仅追加历史条件分支，保留现有默认，不新增权重、强度或账户数据。',
      verified: true,
    },
  },
  'agent-soukaku': {
    sets: [
      '自由蓝调 4 件 + 摇摆爵士 2 件（2025年发布攻略参考：搭配冰属性主力输出，降低冰属性异常积蓄抗性）',
    ],
    source: {
      id: 'miyoushe-64658713-nested-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/64658713',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: 'fe345e39c4e5e493b95e26eb4874f1b72411dea45c971a8afced671638340619',
      licenseBoundary:
        '2025年发布原帖中的已归档独立配盘段落；原帖标题：【1.7攻略征集】苍角 角色玩法介绍。段落自身未标注版本，标题不作为当前适用版本。archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op55 insert.fold unitRawSha256=595fa9efbd5471092f69dab553b774b1a4a8c73ec979fc74554059ccc752136b。仅追加历史条件分支，保留现有默认，不新增权重、强度或账户数据。',
      verified: true,
    },
  },
  'agent-piper': {
    sets: [
      '自由蓝调 4 件 + 獠牙重金属 / 摇摆爵士 2 件（2025年发布攻略参考：辅助紊乱或强击主力输出）',
    ],
    source: {
      id: 'miyoushe-66657195-nested-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/66657195',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '9dafcf813e8a77dc340cbb8bf4d75dba5a6d503585a69ebac6b716fa7efe3285',
      licenseBoundary:
        '2025年发布原帖中的已归档独立配盘段落；原帖标题：【2.1攻略征集】派派 角色玩法介绍。段落自身未标注版本，标题不作为当前适用版本。archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op54 insert.fold unitRawSha256=b0cde665065abc552ab3f2cbb2a397aa9c6cf5e04cda5f6db41b3a147e1ec4ea。仅追加历史条件分支，保留现有默认，不新增权重、强度或账户数据。',
      verified: true,
    },
  },
  'agent-yanagi': {
    sets: ['雷暴重金属 4 件 + 自由蓝调 / 混沌爵士 2 件（2025年发布攻略参考：用于感电队）'],
    source: {
      id: 'miyoushe-67326488-nested-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/67326488',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: 'fb0de9b900c1a676398da9c44c6dfb0409f5268dc72a350f600e2ca82110611d',
      licenseBoundary:
        '2025年发布原帖中的已归档独立配盘段落；原帖标题：【2.1攻略征集】月城柳 角色玩法介绍。段落自身未标注版本，标题不作为当前适用版本。archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op55 insert.fold unitRawSha256=d456a1de5c333d1a079a5bd52e6191c27055b7b572fdfb9398c94ce399e3c0e8。仅追加历史条件分支，保留现有默认，不新增权重、强度或账户数据。',
      verified: true,
    },
  },
  'agent-caesar': {
    sets: ['自由蓝调 4 件 + 震星迪斯科 2 件（2025年发布攻略参考：搭配强击队，加快物理异常积蓄）'],
    source: {
      id: 'miyoushe-65771600-nested-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/65771600',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '1e5fe10c047408a39887cebd788bf373f62504a38186011a8a8c8b30bbd694dc',
      licenseBoundary:
        '2025年发布原帖中的已归档独立配盘段落；原帖标题：【2.0攻略征集】凯撒·金 角色玩法介绍。段落自身未标注版本，标题不作为当前适用版本。archiveSha256=1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd；op57 insert.fold unitRawSha256=2baea021b34df04120fdae92499a0664395429232ad105db281259effa81759b。仅追加历史条件分支，保留现有默认，不新增权重、强度或账户数据。',
      verified: true,
    },
  },
  'agent-zhu-yuan': {
    sets: [
      '混沌重金属 4 件 + 啄木鸟电音 / 激素朋克 2 件（2024年发布攻略参考）',
      '啄木鸟电音 4 件 + 混沌重金属 2 件（2024年发布攻略参考）',
      '混沌重金属 2 件 + 啄木鸟电音 2 件 + 激素朋克 2 件（2024年发布攻略参考）',
    ],
    source: {
      id: 'miyoushe-55577682-image-199405153-disc-supplement',
      url: 'https://www.miyoushe.com/zzz/article/55577682',
      sourceVersion: null,
      checkedAt: '2026-09-10T00:00:00.000Z',
      contentHash: '180aa428376c5226e5c5131f5d80d814485af0d73dbd283e75a1995aca52e2b3',
      licenseBoundary:
        "2024年发布攻略独立配盘图199405153；op47 ['insert', 'image'] opRawSha256=2af87e1ec069d7a068f1160190406f32f7d6f09b1da5ba5b0d522a31c0a1a8cc。原图A/B副套图标与文字有对调，组合集合相同，按Main逐行审阅保留集合；不把图片更新日期或标题作为当前版本。仅追加历史参考，不改现有默认或词条。",
      verified: true,
    },
  },
}

export function getArchivedGuideSetSupplements(agentId: string) {
  return reviewedSetSupplements[agentId] ?? null
}
