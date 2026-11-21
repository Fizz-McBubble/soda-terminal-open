import type { TargetTeamStandardReferenceResult32 } from '../application/targetTeamStandardReference32'
import { formatDevelopmentEntityText, getAgentName } from '../application/publicRosterNames'
import { publicAssetStatLabel } from '../application/publicAssetStatLabels'
import { displayDriveDiscSet, formatDiscStatValue } from './discFactPresentation'

export function StandardReferenceCultivation32({
  result,
}: {
  result: TargetTeamStandardReferenceResult32
}) {
  if (!result.referenceCultivation?.length)
    return result.status === 'unsupported' ? null : (
      <p>此历史参考未保存培养基线；重新生成可查看完整配置。</p>
    )
  return (
    <section aria-label="标准参考培养基线">
      <h3>培养基线</h3>
      <ul>
        {result.referenceCultivation.map((member) => (
          <li key={member.agentId}>
            {getAgentName(member.agentId)} · {member.level}级 · {member.mindscape}影
            {member.potential === null ? ' · 潜能不适用' : ` · 潜能${member.potential}`}
            {' · '}技能{member.effectiveSkillLevel}（基础{member.baseSkillLevel}） · 核心
            {member.coreLevel}
            {' · '}副词条{member.substatRollBudget}次
          </li>
        ))}
      </ul>
    </section>
  )
}

export function StandardReferenceRecipe32({
  result,
  edited = false,
}: {
  result: TargetTeamStandardReferenceResult32
  edited?: boolean
}) {
  if (result.status !== 'selected') return null
  return (
    <section aria-label="已生成的标准参考">
      <h3>{edited ? '上次生成的参考（条件尚未更新）' : '三人标准参考'}</h3>
      <p>在当前候选范围内按已列动作比较。以下为参考盘，不占用账户库存。</p>
      {result.searchDiagnostics ? (
        <p>
          已求值{result.searchDiagnostics.evaluations}套完整配装，其中
          {result.searchDiagnostics.unknownEvaluations}套未满足比较条件，
          {result.searchDiagnostics.differentCoverageEvaluations}套覆盖范围不一致。
          {result.searchDiagnostics.allDiscreteCombinationsVisited
            ? '已遍历所列套装与音擎组合，词条分配仍为有限搜索。'
            : '所列套装与音擎组合尚未全部遍历。'}
        </p>
      ) : null}
      {result.equipment.map((member) => (
        <details key={member.agentId}>
          <summary>
            {getAgentName(member.agentId)} · {formatDevelopmentEntityText(member.engineId)}{' '}
            {member.refinement}叠 · {member.discCount}张参考盘
          </summary>
          {member.discs ? (
            <ol>
              {member.discs.map((disc) => (
                <li key={disc.slot}>
                  {disc.slot}号位 · {displayDriveDiscSet(disc.setId)} +{disc.level} ·{' '}
                  {publicAssetStatLabel(disc.mainStat)}
                  <br />
                  {disc.subStats
                    .map(
                      (stat) =>
                        `${publicAssetStatLabel(stat.stat)} ${formatDiscStatValue(stat.stat, stat.value)}`,
                    )
                    .join('、')}
                </li>
              ))}
            </ol>
          ) : (
            <p>此历史记录未保存参考盘明细；原参考身份仍保留。</p>
          )}
        </details>
      ))}
    </section>
  )
}
