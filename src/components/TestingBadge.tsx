import { ExplanationPopover } from './ExplanationPopover'
import './TestingBadge.css'

const testingScopes = {
  box: {
    label: '说明',
    triggerAriaLabel: '队伍建议使用说明',
    title: '队伍建议使用说明',
    tone: 'help',
    scope: '根据当前账户的角色、养成和仓库提供搭配与培养建议。',
    usage: '可结合游戏内不同副本的敌人、增益和实战表现，自行调整配队与配装。',
  },
  discs: {
    label: '说明',
    triggerAriaLabel: '驱动盘建议使用说明',
    title: '驱动盘建议使用说明',
    tone: 'help',
    scope: '根据驱动盘词条和适用角色提供整理建议；评价分不等于实际伤害收益。',
    usage: '具体换装请在对应代理人或队伍中比较，并结合当前配装与实战需求判断。',
  },
  quickRead: {
    label: '测试版',
    triggerAriaLabel: '资产快读测试版说明',
    title: '资产快读测试版说明',
    tone: 'test',
    scope:
      '资产快读可读取代理人养成、S 级驱动盘及当前装备信息；游戏版本和资料是否齐全会影响读取范围。',
    usage: '读取完成后查看变化，再导入所选账户；没有读到的内容保留原值，导入后仍可修改。',
  },
} as const

export function TestingBadge({ scope }: { scope: keyof typeof testingScopes }) {
  const content = testingScopes[scope]
  return (
    <ExplanationPopover
      label={content.label}
      triggerAriaLabel={content.triggerAriaLabel}
      title={content.title}
      className={`testing-badge testing-badge--${content.tone}`}
      showIndicator={false}
    >
      <p>{content.scope}</p>
      <p>{content.usage}</p>
    </ExplanationPopover>
  )
}
