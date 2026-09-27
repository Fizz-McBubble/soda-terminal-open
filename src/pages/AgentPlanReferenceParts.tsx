import { Link } from 'react-router-dom'
import { type CoreWarehouse } from '../accounts/coreFlow'
import { resolvePotentialImage } from '../assault/agentCapabilities'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'
import {
  playerFacingAgentLabel,
  playerFacingBangbooLabel,
  playerFacingLabel,
} from '../application/playerFacingLabels'
import { type PlanningProfile } from './planningProfile'
import { directionFor } from './planningDraftProjection'

export function CandidateReferenceDirection({ profile }: { profile: PlanningProfile }) {
  const direction = directionFor(profile)
  return (
    <details
      className="panel optimizer-reference-direction"
      aria-label={`${profile.agentName}资料与方案条件`}
    >
      <summary>{profile.agentName}资料与方案条件</summary>
      <p>适用场景：{playerFacingLabel(profile.scenario)}。</p>
      <p>
        来源：{profile.sources.map((source) => playerFacingLabel(source.label)).join('、')}。假设：
        {profile.assumptions.map(playerFacingLabel).join('；') || '资料待补齐'}
      </p>
      {profile.recommendation ? (
        <ul>
          <li>音擎方向：{direction.wEngineDirection}。</li>
          <li>驱动盘与主词条方向：{direction.discDirection}。</li>
          <li>
            关键副词条：
            {getCandidateStatLabels(profile.recommendation.subStats, '副词条').join('、')}。
          </li>
          <li>养成建议：{direction.progressionDirection}</li>
          <li>
            队伍与邦布方向：
            {profile.recommendation.teammates.map(playerFacingAgentLabel).join('、')}；
            {profile.recommendation.bangboos.map(playerFacingBangbooLabel).join('、')}。
          </li>
        </ul>
      ) : (
        <p>当前没有可安全展开的参考方案：{profile.gaps.join('；')}。</p>
      )}
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
      <p className="muted-note">
        当前最终属性与毕业目标仅在有对应来源字段时显示；驱动盘匹配不代表伤害或属性结论。
      </p>
    </section>
  )
}

export function MissingDirection({ profile }: { profile: PlanningProfile }) {
  return (
    <section className="panel status-card is-warning" role="status">
      <h2>资料待补齐</h2>
      <p>
        {profile.agentName}目前缺少：{profile.gaps.join('；')}。不能生成虚假计算或伤害结果。
      </p>
      <Link
        className="button button--secondary"
        to={`/development/${profile.agentId}?panel=knowledge`}
      >
        返回代理人养成
      </Link>
    </section>
  )
}
