import { Link } from 'react-router-dom'
import { type CoreWarehouse } from '../accounts/coreFlow'
import { resolvePotentialImage } from '../assault/agentCapabilities'
import { formatCandidateSubStatDirections } from '../application/publicCandidateLabels'
import {
  playerFacingAgentLabel,
  playerFacingBangbooLabel,
  playerFacingLabel,
} from '../application/playerFacingLabels'
import { type PlanningProfile } from './planningProfile'
import { directionFor } from './planningDraftProjection'

export function CandidateReferenceDirection({ profile }: { profile: PlanningProfile }) {
  const direction = directionFor(profile)
  const visible = (value: string) => Boolean(value.trim()) && !value.includes('资料待补齐')
  const scenario = playerFacingLabel(profile.scenario)
  const assumptions = profile.assumptions.map(playerFacingLabel).filter(visible)
  const teammates = profile.recommendation?.teammates.map(playerFacingAgentLabel).filter(visible)
  const bangboos = profile.recommendation?.bangboos.map(playerFacingBangbooLabel).filter(visible)
  const directions = profile.recommendation
    ? (
        [
          ['音擎方向', direction.wEngineDirection],
          ['驱动盘与主词条方向', direction.discDirection],
          [
            '关键副词条',
            formatCandidateSubStatDirections(profile.recommendation.subStats)
              .filter(visible)
              .join('、'),
          ],
          ['养成建议', direction.progressionDirection],
          [
            '队伍与邦布方向',
            [teammates?.join('、'), bangboos?.join('、')].filter(Boolean).join('；'),
          ],
        ] as const
      ).filter(([, value]) => visible(value))
    : []
  return (
    <details
      className="panel optimizer-reference-direction"
      aria-label={`${profile.agentName}配装方向与条件`}
    >
      <summary>{profile.agentName}配装方向与条件</summary>
      {visible(scenario) ? <p>适用场景：{scenario}。</p> : null}
      {assumptions.length ? <p>使用条件：{assumptions.join('；')}。</p> : null}
      {directions.length ? (
        <ul>
          {directions.map(([label, value]) => (
            <li key={label}>
              {label}：{value}
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        className="button button--secondary"
        to={`/development/${profile.agentId}?panel=knowledge`}
      >
        返回代理人养成
      </Link>
    </details>
  )
}

export function PlayerAssetSummary({
  warehouse,
  agentId,
}: {
  warehouse: CoreWarehouse
  agentId: string
}) {
  const agent = warehouse.roster.agents.find((item) => item.agentId === agentId)
  if (!agent) return null
  return (
    <section className="panel optimizer-player-asset-summary" aria-label="当前角色资产面板">
      <h2>当前角色资产</h2>
      <p>
        等级 {agent.level} · 影画 {agent.mindscape} · 潜能影像{' '}
        {resolvePotentialImage(agentId, agent.potentialImage) ?? '不适用'} · 音擎{' '}
        {agent.wEngineDetails.name ?? '未选择'}。
      </p>
      <p>
        技能：普攻 {agent.skillLevels.basic ?? '待填'}、特殊 {agent.skillLevels.special ?? '待填'}
        、连携 {agent.skillLevels.chain ?? '待填'}、核心 {agent.skillLevels.core ?? '待填'}。
      </p>
    </section>
  )
}

export function MissingDirection({ profile }: { profile: PlanningProfile }) {
  return (
    <section className="panel status-card is-warning" role="status">
      <h2>暂无配装建议</h2>
      <Link
        className="button button--secondary"
        to={`/development/${profile.agentId}?panel=knowledge`}
      >
        返回代理人养成
      </Link>
    </section>
  )
}
