/* Internal source locator omitted.



 */

export type ReviewedEngineConditionRule = {
  sourceText: string
  disposition: 'engine' | 'elsewhere' | 'redundant' | 'internal'
  notes?: readonly { engineId: string; text: string }[]
}

export const reviewedEngineConditionRules33: Readonly<
  Record<string, readonly ReviewedEngineConditionRule[]>
> = {
  'agent-roxy': [
    {
      sourceText:
        '最大核心的回能转换上限可从技能静态系数推导为初始回能 3.12；其他核心等级不能沿用该上限。',
      disposition: 'elsewhere',
    },
    {
      sourceText:
        '最大核心的团队暴伤 / 锐暴转换在百分之百暴击率达到上限；不是所有核心等级通用的毕业面板。',
      disposition: 'elsewhere',
    },
    {
      sourceText: '回能与暴击率先满足真实机制，不能因击破特性直接套用冲击力六号位的通用模板。',
      disposition: 'elsewhere',
    },
    {
      sourceText: '绯月银棺：专属击破方向。',
      disposition: 'redundant',
    },
    {
      sourceText: '人为刀俎满精：可优先考虑的替代方向；需维持80点能量以发挥音擎效果。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-13005',
          text: '满精炼、能量保持80点时可发挥效果。',
        },
      ],
    },
    {
      sourceText:
        '燃狱齿轮1阶：在以下比较条件下，此精炼的表现低于满精人为刀俎，强化特殊技后续叠层较迟；高精炼需另行比较。',
      disposition: 'internal',
    },
    {
      sourceText:
        '仅适用于洛克茜 + 猩红渴望克拉蕾 + 啜泣摇篮丽娜；不能外推到其他队伍、精炼或最佳配装。',
      disposition: 'internal',
    },
  ],
  'agent-claret': [
    {
      sourceText: '锐化伤害按防御力计算，普通攻击力词条不能沿用传统强攻收益。',
      disposition: 'elsewhere',
    },
    {
      sourceText:
        '超过百分之百暴击率的二次锐暴判定可继续受益；满概率边界需合并实际核心、音擎与队伍条件。',
      disposition: 'elsewhere',
    },
    {
      sourceText: '荆棘玫瑰初始防御 1000 / 1800 档位提供不同暴击率；属于套装条件，不是毕业目标。',
      disposition: 'elsewhere',
    },
    {
      sourceText: '猩红渴望：专属锋御方向。',
      disposition: 'redundant',
    },
    {
      sourceText: '血髓秘匣与喵运当头：可尝试的替代方向，精炼与队伍增益影响比较。',
      disposition: 'redundant',
    },
  ],
  'agent-cissia': [
    {
      sourceText:
        '「旋钻机-赤轴」是可尝试的A级替代；先发动强化特殊技或连携技触发普攻电伤增益。单输出与辅助用途需要分别比较，列出顺序不代表统一收益排名。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-13111',
          text: '先用强化特殊技或连携技，触发普攻电伤增益。',
        },
      ],
    },
    {
      sourceText: '「机巧心种」只按原文主C流希希芙条件保留，不作为辅助席德的无条件自动选项。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-14146',
          text: '用于主输出玩法；辅助席德时不按此方向选用。',
        },
      ],
    },
    {
      sourceText: '查看这套搭配的适用条件。',
      disposition: 'internal',
    },
  ],
  'agent-banyue': [
    {
      sourceText:
        '「燔火胧夜」仅在已高阶且不培养真斗时作为第三顺位参考；不加入无条件自动音擎列表。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-13144',
          text: '已有高精炼、且不培养真斗时，可作为借用选项。',
        },
      ],
    },
  ],
  'agent-yidhari': [
    {
      sourceText:
        '借用「青溟笼舍」时，伊德海莉可获得生命值和暴击率加成，但无法触发要求以太贯穿伤害的其他效果；借用「燔火胧夜」时，主要取生命加成及生命降低时的暴击收益，高阶时可考虑。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-14137',
          text: '可获得生命值和暴击率；无法触发要求以太贯穿伤害的其他效果。',
        },
        {
          engineId: 'wengine-13144',
          text: '主要利用生命加成及生命降低时的暴击收益，高精炼时可考虑。',
        },
      ],
    },
  ],
  'agent-ju-fufu': [
    {
      sourceText:
        '「燃狱齿轮」的后台回能覆盖率随招式、开局能量和战斗时长变化；特殊连携及高速旋转处于场上，虎威自动攻击属于后台。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-14110',
          text: '后台时获得回能；特殊连携与高速旋转处于场上，虎威自动攻击属于后台。',
        },
      ],
    },
    {
      sourceText:
        '「人为刀俎」需要先积攒并尽量保持较高能量；较低基础攻击力会提高达到3400攻击力目标的驱动盘需求。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-13005',
          text: '先积攒并保持较高能量；基础攻击力较低，需要更多攻击力词条。',
        },
      ],
    },
  ],
  'agent-vivian': [
    {
      sourceText:
        '「双生泣星」更适合长线高血量敌人，短战斗叠层少时表现下降；「触电唇彩」面对处于异常状态的敌人触发增益，稳定A级替代。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-13008',
          text: '适合长线战斗；短战叠层不足时收益下降。',
        },
        {
          engineId: 'wengine-13009',
          text: '需要敌人处于异常状态，才能触发增益。',
        },
      ],
    },
  ],
  'agent-yanagi': [
    {
      sourceText:
        '「触电唇彩」需敌人处于异常状态并有启动时间；「双生泣星」适合精英或BOSS，增益持续至敌人从失衡恢复或死亡，打小怪相对一般。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-13009',
          text: '需要敌人处于异常状态，并留出启动时间。',
        },
        {
          engineId: 'wengine-13008',
          text: '适合精英或首领；增益持续至敌人从失衡恢复或死亡，短战清杂收益较低。',
        },
      ],
    },
    {
      sourceText:
        '装备「时流贤者」时，异常精通达到 375 才会触发其紊乱伤害增益；这是音擎效果条件，不是所有柳配装的无条件最低面板。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-14122',
          text: '异常精通达到375时，触发其紊乱伤害增益。',
        },
      ],
    },
  ],
  'agent-soldier-11': [
    {
      sourceText:
        '心弦夜响S1：双暴属性常驻；火抗忽视仅对连携与终结技，层数须按实际触发。硫磺石保留为可用替代。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-14132',
          text: '火抗忽视只用于火属性连携和终结技，按实际触发叠层。',
        },
      ],
    },
  ],
  'agent-koleda': [
    {
      sourceText:
        '山大王提供普通暴击伤害，不能当成锋御锐暴增益；静听嘉音按快速支援入场者及实际层数生效。',
      disposition: 'elsewhere',
    },
    {
      sourceText: '达到50%暴击率只改变山大王追加团队暴伤档位；并非通用毕业门槛。',
      disposition: 'elsewhere',
    },
    {
      sourceText: '3.2页面的明确构筑与已锁定机制交叉核对；不据此声明全队强度、全局最优或完整循环。',
      disposition: 'internal',
    },
    {
      sourceText: '燃狱齿轮：冲击与强化特殊技方向。',
      disposition: 'redundant',
    },
    {
      sourceText:
        '焰心桂冠：非锋御队可尝试的备选；首席跟班：锋御队可尝试的备选，需满足实际失衡需求。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-14116',
          text: '非锋御队可选；仍需满足实际失衡需求。',
        },
        {
          engineId: 'wengine-14157',
          text: '锋御队可选；仍需满足实际失衡需求。',
        },
      ],
    },
    {
      sourceText: '贵重骨核与人为刀俎：短战与回能条件不同，按实际精炼和队伍比较。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-13006',
          text: '适合短战。',
        },
        {
          engineId: 'wengine-13005',
          text: '需要先积攒能量，再发挥音擎效果。',
        },
      ],
    },
  ],
  'agent-pan-yinhu': [
    {
      sourceText: '「春日融融」可用于攻击力及自身、队友回能选项；属于月卡音擎。',
      disposition: 'internal',
    },
    {
      sourceText: '查看这套搭配的适用条件。',
      disposition: 'internal',
    },
  ],
  'agent-seth': [
    {
      sourceText:
        '「震元奇枢」可用于攻击力和强化特殊技伤害选项；队伍中角色受到伤害时，为装备者提供能量回复。',
      disposition: 'internal',
    },
    {
      sourceText: '查看这套搭配的适用条件。',
      disposition: 'internal',
    },
  ],
  'agent-nicole': [
    {
      sourceText: '「好斗的阿炮」可用于回能和全队攻击力增益选项。',
      disposition: 'internal',
    },
    {
      sourceText: '查看这套搭配的适用条件。',
      disposition: 'internal',
    },
  ],
  'agent-anton': [
    {
      sourceText:
        '心弦夜响S1主要提供双暴；火抗忽视只作用于火伤，不能用于安东的电伤。旋钻机-赤轴A5保留为易得替代。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-14132',
          text: '火抗忽视不能提升电属性伤害；双暴加成按实际触发。',
        },
      ],
    },
  ],
  'agent-soukaku': [
    {
      sourceText:
        '「好斗的阿炮」可用于回能选项，用于积攒能量施放强化特殊技，并提供全队攻击力加成。',
      disposition: 'internal',
    },
    {
      sourceText: '查看这套搭配的适用条件。',
      disposition: 'internal',
    },
  ],
  'agent-piper': [
    {
      sourceText:
        '十方锻星S1：60点异常掌控；物伤加成进入接战即有两层、可由强击刷新。轰鸣座驾A5保留为易得替代。',
      disposition: 'engine',
      notes: [
        {
          engineId: 'wengine-14140',
          text: '精炼1提供60点异常掌控；物伤增益入场即有两层，可由强击刷新。',
        },
      ],
    },
  ],
}
