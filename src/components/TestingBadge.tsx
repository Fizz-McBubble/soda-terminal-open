import { ExplanationPopover } from './ExplanationPopover'
import './TestingBadge.css'

const testingScopes = {
  box: {
    title: 'BOX 配队测试说明',
    scope:
      '根据当前账户的代理人、养成与仓库提供配队方向和培养参考。评级与推荐仍在持续校准，不代表全部副本的最优队伍。',
    usage: '可结合游戏内不同副本的敌人、增益和实战表现，自行调整配队与配装。',
  },
  discs: {
    title: '驱动盘分析测试说明',
    scope:
      '根据驱动盘词条与适用角色提供评价、保留潜力和候选用途，帮助筛选与整理仓库。评价分不是实际伤害收益。',
    usage: '具体换装请在对应代理人或队伍中比较，并结合当前配装与实战需求判断。',
  },
  quickRead: {
    title: '资产快读测试说明',
    scope:
      '资产快读可读取代理人养成、S 级驱动盘及当前装备信息；游戏版本更新和未观测字段仍可能影响读取范围。',
    usage: '读取完成后先检查结果，再导入目标账户；未读到的内容保留原值，导入后仍可自行修正。',
  },
} as const

export function TestingBadge({ scope }: { scope: keyof typeof testingScopes }) {
  const content = testingScopes[scope]
  return (
    <ExplanationPopover
      label="测试"
      title={content.title}
      className="testing-badge"
      showIndicator={false}
    >
      <p>{content.scope}</p>
      <p>{content.usage}</p>
    </ExplanationPopover>
  )
}
