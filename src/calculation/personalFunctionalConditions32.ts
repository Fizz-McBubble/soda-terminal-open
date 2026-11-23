import { z } from 'zod'

/** Source-scoped combat coordinates. These never replace panel or team facts. */
export const personalFunctionalConditionsSchema32 = z
  .object({
    flags: z
      .object({
        'HellfireGears:offField': z.boolean().optional(),
        'BlazingLaurel:quickOrPerfectAssistUsed': z.boolean().optional(),
        'BoxCutter:launchedAftershock': z.boolean().optional(),
        'YesterdayCalls:offField': z.boolean().optional(),
        'FeatheredFate:entersOrActive': z.boolean().optional(),
        'PhaethonsMelody:squad_use_ex': z.boolean().optional(),
        hunters_gait: z.boolean().optional(),
        tigers_roar: z.boolean().optional(),
      })
      .strict()
      .optional(),
    stacks: z
      .object({
        'HellfireGears:exSpecialUsed': z.number().int().min(0).max(2).optional(),
        'IceJadeTeapot:teariffic': z.number().int().min(0).max(30).optional(),
        'SpectralGaze:spiritLock': z.number().int().min(0).max(3).optional(),
        'YesterdayCalls:physExSpecialUsed': z.number().int().min(0).max(3).optional(),
        morale_consumed: z.number().int().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
export type PersonalFunctionalConditions32 = z.infer<typeof personalFunctionalConditionsSchema32>

type Field = {
  key: string
  label: string
  kind: 'boolean' | 'integer'
  sourceRefs: readonly string[]
  engineId?: string
  discSetId?: string
  agentId?: string
  min?: number
  max?: number
}
const fields: readonly Field[] = [
  {
    key: 'HellfireGears:offField',
    label: '燃狱齿轮：处于后台回能状态',
    kind: 'boolean',
    engineId: 'wengine-14110',
    sourceRefs: [
      'HellfireGears.ts#66590F7D44A057647179FEA99AB7C0ABAC8810492971E9006A0341427BE45763',
    ],
  },
  {
    key: 'HellfireGears:exSpecialUsed',
    label: '燃狱齿轮：强化特殊技有效层数',
    kind: 'integer',
    min: 0,
    max: 2,
    engineId: 'wengine-14110',
    sourceRefs: [
      'HellfireGears.ts#66590F7D44A057647179FEA99AB7C0ABAC8810492971E9006A0341427BE45763',
    ],
  },
  {
    key: 'BlazingLaurel:quickOrPerfectAssistUsed',
    label: '焰心桂冠：支援触发的冲击增益生效',
    kind: 'boolean',
    engineId: 'wengine-14116',
    sourceRefs: [
      'BlazingLaurel.ts#0D41616E2762D215D46C39E6D04BF230B5B6B84DC734F60DC4AC2C564FA46751',
    ],
  },
  {
    key: 'IceJadeTeapot:teariffic',
    label: '玉壶青冰：有效层数',
    kind: 'integer',
    min: 0,
    max: 30,
    engineId: 'wengine-14125',
    sourceRefs: [
      'IceJadeTeapot.ts#C6774FD202D92C254D35CC983331C8F0DE9A25734A990887F8DC61435F5A1085',
    ],
  },
  {
    key: 'BoxCutter:launchedAftershock',
    label: '裁纸刀：追加攻击增益生效',
    kind: 'boolean',
    engineId: 'wengine-13135',
    sourceRefs: ['BoxCutter.ts#0C06ED29F2AF3C51B13ADF18493C654E0B81CFA871A6747F54EE2B57B2D34EDC'],
  },
  {
    key: 'SpectralGaze:spiritLock',
    label: '索魂影眸：锁定状态有效层数',
    kind: 'integer',
    min: 0,
    max: 3,
    engineId: 'wengine-14136',
    sourceRefs: [
      'SpectralGaze.ts#8EF041393A611EF01D23D8C8A0CA5E3E521E07A8FFE6581F6D3D5D7B9C1A2B95',
    ],
  },
  {
    key: 'YesterdayCalls:offField',
    label: '昨夜来电：处于后台回能状态',
    kind: 'boolean',
    engineId: 'wengine-14148',
    sourceRefs: [
      'YesterdayCalls.ts#EA590E03BDF1F98BC2104BD76E867FA27A3BC9D647B6DB376DCDC72B0191C0B4',
    ],
  },
  {
    key: 'YesterdayCalls:physExSpecialUsed',
    label: '昨夜来电：物理强化特殊技有效层数',
    kind: 'integer',
    min: 0,
    max: 3,
    engineId: 'wengine-14148',
    sourceRefs: [
      'YesterdayCalls.ts#EA590E03BDF1F98BC2104BD76E867FA27A3BC9D647B6DB376DCDC72B0191C0B4',
    ],
  },
  {
    key: 'FeatheredFate:entersOrActive',
    label: '谶羽四件：入场或在场精通增益生效',
    kind: 'boolean',
    discSetId: 'set-34100',
    sourceRefs: [
      'FeatheredFate.ts#CDAE80241142E2D52FB1A2ECFBCB960B9CDE1E77E9BD34A9D512EB238F493977',
    ],
  },
  {
    key: 'PhaethonsMelody:squad_use_ex',
    label: '法厄同四件：队伍强化特殊技精通增益生效',
    kind: 'boolean',
    discSetId: 'set-phaethons-melody',
    sourceRefs: [
      'PhaethonsMelody.ts#0E242F3B3620536FEF6CF8D90B01A084BFA96C74CAB27F3E15BDD173F9C3EA31',
    ],
  },
  {
    key: 'hunters_gait',
    label: '波可娜：猎步状态生效',
    kind: 'boolean',
    agentId: 'agent-pulchra',
    sourceRefs: ['Pulchra.ts#136C36B91C1E06975759E9C89F7A2D8B4B994588FF2AD607514F56A4F6B8027A'],
  },
  {
    key: 'tigers_roar',
    label: '橘福福：虎啸状态生效',
    kind: 'boolean',
    agentId: 'agent-ju-fufu',
    sourceRefs: ['JuFufu.ts#AD33CBC292233EA3D57921C0667CC327F368876133A7C29D76D8917E8D6C3B51'],
  },
  {
    key: 'morale_consumed',
    label: '莱特：当前增益对应的已消耗士气',
    kind: 'integer',
    min: 0,
    max: 100,
    agentId: 'agent-lighter',
    sourceRefs: ['Lighter.ts#4AE8698C1FF65B9A4B56CF89024DF3CA9D3D9061912455A4FDBB6F977938182A'],
  },
]

export function personalFunctionalConditionFields32(input: {
  agentId: string
  engineIds: readonly string[]
  discSetIds: readonly string[]
}) {
  return fields.filter(
    (field) =>
      (field.agentId === undefined || field.agentId === input.agentId) &&
      (field.engineId === undefined || input.engineIds.includes(field.engineId)) &&
      (field.discSetId === undefined || input.discSetIds.includes(field.discSetId)),
  )
}
