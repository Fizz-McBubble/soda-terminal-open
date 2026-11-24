const overlyPreciseDecimal = /-?\d+\.\d{3,}/g

export function formatTeamExecutionNumberText(value: string | number) {
  return String(value).replace(overlyPreciseDecimal, (token) => {
    const rounded = Math.round(Number(token) * 100) / 100
    return Object.is(rounded, -0) ? '0' : String(rounded)
  })
}

const simplifiedSchemeNotes: Readonly<Record<string, string>> = {
  '本次找到的方案可能仍有更合适的替代。': '仓库中可能还有更合适的驱动盘组合。',
  '缺少一条已验证盘面资料。': '有 1 项盘面资料待核对。',
  '当前事件比较条件不足，保留完整来源候选方案。': '部分效果条件不足，当前展示来源候选方案。',
  '部分效果条件尚未确认或搜索有界；结果仅适用于声明的比较条件。':
    '部分效果条件待确认，结果仅按当前比较条件展示。',
  '来源未指定第二个 2 件套；该两件套仅作未评分库存补位。':
    '补位两件套仅按现有库存补齐，未计入评分。',
  '暂未凑齐推荐组合，保留推荐主套四件，用现有同套两件过渡；副套收益未计入匹配分，不代表毕业配装。':
    '推荐组合暂未齐；当前用同套两件过渡，副套收益未计入。',
  '按当前有效技能的精确初始攻击准备线比较，达标后保留来源候选取舍；不证明战斗增益已生效。': '',
  '按当前有效技能的精确初始攻击准备线比较，达标后保留来源候选取舍；不证明战斗增益已生效。本次搜索有界。':
    '',
}

export function playerFacingTeamSchemeNote(value: string) {
  const normalized = value
    .trim()
    .replace(/^方案注意[：:]\s*/u, '')
    .replace(/\s+/gu, ' ')
  const note = simplifiedSchemeNotes[normalized] ?? normalized.replace(/[；;]+$/u, '。')
  return note.replace(
    /攻击力(\d+\.\d{3,})/gu,
    (_, amount: string) => `攻击力约${formatTeamExecutionNumberText(amount)}`,
  )
}
