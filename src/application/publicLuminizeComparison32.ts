import { z } from 'zod'
import { savedDeclaredLuminizeSettlement32Schema } from '../accounts/luminizeSavedContract32'

export const accountLuminizeEquipmentBoundary32 =
  '账号局外静态配装的有限准备比较：两名普通属性队友各声明一份常规虚光，按同一准备坐标0构造。折光用准备时丽弥尔精通、异常人数和影画计算并保存一次，辉映使用当前丽弥尔面板。敌人防御、抗性、易伤与失衡采用所选基线，无额外战斗减防、减抗或条件音擎、四件套与角色效果；棱彩窗口仅按显式选项。排除技能专属、异常专属与暴击增伤，以及M1/M6自身特殊虚光、取得队列和完整轮转；仅单次非暴击装备比较，不代表完整循环、DPS、Formal或历史战斗快照。'

/** A named equipment counterfactual, never an observation of a combat rotation. */
export const luminizeEquipmentComparisonOptionsSchema32 = z
  .object({
    contract: z.literal('soda-luminize-equipment-comparison32/v1'),
    skill: z.enum(['rainbows_end', 'fleeting_grace', 'ultimate', 'flower_feather']),
    prismaticDefenseIgnoreWindow: z.boolean(),
  })
  .strict()

export type LuminizeEquipmentComparisonOptions32 = z.infer<
  typeof luminizeEquipmentComparisonOptionsSchema32
>

/** A fixed equipment preparation protocol, not an observed cast or M2 window. */
export const luminizeEquipmentPreparationProtocol32: LuminizeEquipmentComparisonOptions32 = {
  contract: 'soda-luminize-equipment-comparison32/v1',
  skill: 'rainbows_end',
  prismaticDefenseIgnoreWindow: false,
}

export const luminizeEquipmentSnapshotSchema32 = z
  .object({
    status: z.enum(['supported', 'unsupported']),
    basis: z.literal('account_equipment_static_preparation'),
    assetBindingFingerprint: z.string().min(1),
    snapshot: savedDeclaredLuminizeSettlement32Schema.nullable(),
    totalDamage: z.number().finite().nonnegative().nullable(),
    blockers: z.array(z.string().min(1)),
    boundary: z.string().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.status === 'supported' &&
        (!value.snapshot || value.totalDamage === null || value.blockers.length > 0)) ||
      (value.status === 'unsupported' &&
        (value.snapshot !== null || value.totalDamage !== null || !value.blockers.length))
    )
      context.addIssue({ code: 'custom', message: '辉映配装快照的状态与数值不一致。' })
  })

export type LuminizeEquipmentSnapshot32 = z.infer<typeof luminizeEquipmentSnapshotSchema32>

export type LuminizeEquipmentComparison32 = {
  status: 'supported' | 'unsupported' | 'stale'
  currentDamage: number | null
  candidateDamage: number | null
  delta: number | null
  basis: 'account_equipment_static_preparation'
  blockers: string[]
  boundary: string
}
