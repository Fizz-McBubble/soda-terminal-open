import { getAgentName } from '../application/publicRosterNames'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'

export function visibleDecisionText(value: string) {
  return value
    .replace(/agent-[a-z0-9-]+/giu, (agentId) => getAgentName(agentId))
    .replace(/bangboo-[a-z0-9-]+/giu, (bangbooId) => playerFacingBangbooLabel(bangbooId))
    .replace(
      '当前账户已形成版本化队伍与实体盘互斥 Candidate 决策。',
      '当前账户已形成可直接执行的队伍建议。',
    )
    .replace(
      '当前账户决策未同时通过版本化队伍机制与实体盘分配门，结果保持 unsupported。',
      '当前账户尚未同时满足队伍搭配与实体装备条件，暂时无法形成可执行建议。',
    )
    .replaceAll('Account Decision', '本次分析')
    .replaceAll('Team Engine', '队伍分析')
    .replaceAll('Decision', '分析')
    .replaceAll('Claim', '结论')
    .replace(/\s*Candidate\s*强度/gu, '参考强度')
    .replace(/\s*Candidate/gu, '方案')
    .replaceAll('executable', '可执行方案')
    .replace(/\s*unsupported/gu, '暂时无法形成答案')
    .replaceAll('Formal', '精确计算结论')
    .replace('版本化队伍与实体盘互斥', '当前队伍搭配与实体装备')
    .replace('版本化队伍机制与实体盘分配门', '队伍搭配与实体装备条件')
    .replace('方案 决策', '队伍建议')
}
