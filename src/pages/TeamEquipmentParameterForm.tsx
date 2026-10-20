import { PlayerSelect } from '../components/PlayerSelect'
import type {
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { currentBangbooDirectory, getAgentName } from '../assault/catalog'
import { VisualEntityImage } from '../components/VisualEntityImage'
import './team-equipment-parameters.css'
import { BangbooActivationDetails } from './BangbooActivationDetails'
import { wEngineOptions } from '../application/equipmentParameterSelection'
import type { DevelopmentWEngineComparisonDto } from '../application/publicDevelopmentWEngineComparison'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmark'
// eslint-disable-next-line react-refresh/only-export-components
export { equipmentParameterSelection } from '../application/equipmentParameterSelection'

type EquipmentRecommendations = TargetTeamWarehouseFitQueryResult['equipmentRecommendations']

type WEngineControlProps = { agentId: string; pending: boolean } & (
  | {
      comparison: {
        entries: DevelopmentWEngineComparisonDto['entries']
        selectedOptionKey: string | null
        parameters?: DevelopmentComparisonParameters['wEngine']
        onSelect: (optionKey: string) => void
        onRefinement: (refinement: number) => void
      }
      recommendations?: never
      selection?: never
      onChange?: never
    }
  | {
      comparison?: undefined
      recommendations: EquipmentRecommendations
      selection: TargetTeamEquipmentParameterSelection
      onChange: (selection: TargetTeamEquipmentParameterSelection) => void
    }
)

export function TeamSchemeWEngineControl({
  agentId,
  recommendations,
  selection,
  pending,
  onChange,
  comparison,
}: WEngineControlProps) {
  if (comparison) {
    const groups = [
      ...new Set(
        comparison.entries.flatMap((entry) =>
          entry.comparisonGroupId ? [entry.comparisonGroupId] : [],
        ),
      ),
    ]
    const selected = comparison.entries.find(
      (entry) => entry.optionKey === comparison.selectedOptionKey,
    )
    return (
      <div className="team-execution__scheme-control team-execution__scheme-control--confirmation">
        <label>
          <span>音擎</span>
          <PlayerSelect
            aria-label={`${getAgentName(agentId)} 方案音擎`}
            disabled={pending || !comparison.entries.length}
            value={comparison.selectedOptionKey ?? (comparison.parameters ? '__adjusted__' : '')}
            onChange={comparison.onSelect}
          >
            <option value="" disabled>
              {pending ? '正在计算音擎选项…' : '选择音擎参数'}
            </option>
            {comparison.parameters && !comparison.selectedOptionKey ? (
              <option value="__adjusted__" disabled>
                {comparison.entries.find(
                  (entry) => entry.engineId === comparison.parameters!.engineId,
                )?.name ?? comparison.parameters.engineId}
                {` · 方案参数 Lv.${comparison.parameters.level} / P${comparison.parameters.refinement}`}
              </option>
            ) : null}
            {comparison.entries.map((entry) => (
              <option key={entry.optionKey} value={entry.optionKey} disabled={!entry.parameters}>
                {entry.label ?? entry.name}
                {entry.rankWithinGroup !== null && entry.comparisonGroupId
                  ? ` · 同条件组${groups.indexOf(entry.comparisonGroupId) + 1} 第${entry.rankWithinGroup}`
                  : ' · 未排序'}
                {entry.value !== null
                  ? ` · ${Number(entry.value.toFixed(2))}${entry.metric === 'prepared_anomaly_damage' ? ' 单次结算' : ' 固定事件规划DPS'}`
                  : ''}
              </option>
            ))}
          </PlayerSelect>
        </label>
        <label>
          <span>精炼</span>
          <PlayerSelect
            aria-label={`${getAgentName(agentId)} 方案音擎精炼`}
            disabled={pending || !comparison.parameters}
            value={comparison.parameters?.refinement ?? ''}
            onChange={(value) => comparison.onRefinement(Number(value))}
          >
            <option value="" disabled>
              未选择
            </option>
            {[1, 2, 3, 4, 5].map((rank) => (
              <option key={rank} value={rank}>
                P{rank}
              </option>
            ))}
          </PlayerSelect>
        </label>
        {selected?.reasons.length ? <p>{selected.reasons.join('；')}</p> : null}
      </div>
    )
  }
  const recommendation = recommendations.wEngines.find((item) => item.agentId === agentId)
  if (!recommendation)
    return <span className="team-execution__scheme-unavailable">暂无推荐音擎</span>
  const options = wEngineOptions(recommendation)
  const current = selection.wEngines.find((item) => item.agentId === agentId) ?? {
    agentId,
    engineId: '',
    refinement: 1,
  }
  const update = (next: Partial<typeof current>) =>
    onChange({
      ...selection,
      wEngines: selection.wEngines.map((item) =>
        item.agentId === agentId ? { ...current, ...next } : item,
      ),
    })
  const selected = options.find((item) => item.engineId === current.engineId)

  return (
    <div className="team-execution__scheme-control team-execution__scheme-control--wengine">
      {current.engineId ? (
        <VisualEntityImage
          className="team-execution__scheme-image"
          entityType="wengine"
          entityId={current.engineId}
          name={selected?.name ?? current.engineId}
          slotId="wengine.equipment-icon"
          consumer="box.team-workspace"
        />
      ) : null}
      <label>
        <span>音擎</span>
        <PlayerSelect
          aria-label={`${getAgentName(agentId)} 方案音擎`}
          disabled={pending || !options.length}
          value={current.engineId}
          onChange={(value) => {
            const next = options.find((item) => item.engineId === value)
            update({
              engineId: value,
              level: next?.level,
              ascension: next?.ascension,
              refinement: next?.refinement ?? current.refinement,
            })
          }}
        >
          {!options.length ? <option value="">暂无推荐音擎</option> : null}
          {options.map((item) => (
            <option key={item.engineId} value={item.engineId}>
              {item.name}
            </option>
          ))}
        </PlayerSelect>
      </label>
      <label>
        <span>精炼</span>
        <PlayerSelect
          aria-label={`${getAgentName(agentId)} 方案音擎精炼`}
          disabled={pending || !options.length}
          value={current.refinement}
          onChange={(value) => update({ refinement: Number(value) })}
        >
          {[1, 2, 3, 4, 5].map((rank) => (
            <option key={rank} value={rank}>
              P{rank}
            </option>
          ))}
        </PlayerSelect>
      </label>
    </div>
  )
}

export function TeamSchemeBangbooControl({
  recommendations,
  selection,
  pending,
  onChange,
}: {
  recommendations: EquipmentRecommendations
  selection: TargetTeamEquipmentParameterSelection
  pending: boolean
  onChange: (selection: TargetTeamEquipmentParameterSelection) => void
}) {
  const options = [
    ...recommendations.bangboo.options,
    ...currentBangbooDirectory
      .filter(
        (entry) =>
          entry.releaseState === 'released' &&
          entry.accountOwnable &&
          !recommendations.bangboo.options.some((option) => option.bangbooId === entry.id),
      )
      .map((entry) => ({ bangbooId: entry.id, name: entry.name, defaultStars: 1 })),
  ]
  const selected = options.find((item) => item.bangbooId === selection.bangbooId)
  return (
    <div className="team-execution__scheme-control team-execution__scheme-control--bangboo">
      {selection.bangbooId ? (
        <VisualEntityImage
          className="team-execution__scheme-image"
          entityType="bangboo"
          entityId={selection.bangbooId}
          name={selected?.name ?? selection.bangbooId}
          slotId="bangboo.team-icon"
          consumer="box.team-workspace"
        />
      ) : null}
      <label>
        <span>邦布</span>
        <PlayerSelect
          aria-label="方案邦布"
          disabled={pending || !options.length}
          value={selection.bangbooId}
          onChange={(value) => {
            const next = options.find((item) => item.bangbooId === value)
            onChange({
              ...selection,
              bangbooId: value,
              bangbooStars: next?.defaultStars ?? selection.bangbooStars,
            })
          }}
        >
          {!options.length ? <option value="">暂无可选邦布</option> : null}
          {options.map((item) => (
            <option key={item.bangbooId} value={item.bangbooId}>
              {item.name}
            </option>
          ))}
        </PlayerSelect>
      </label>
      <label>
        <span>星级</span>
        <PlayerSelect
          aria-label="方案邦布星级"
          disabled={pending || !options.length}
          value={selection.bangbooStars}
          onChange={(value) => onChange({ ...selection, bangbooStars: Number(value) })}
        >
          {[1, 2, 3, 4, 5].map((stars) => (
            <option key={stars} value={stars}>
              {stars} 星
            </option>
          ))}
        </PlayerSelect>
      </label>
      <BangbooActivationDetails
        memberIds={recommendations.wEngines.map((item) => item.agentId)}
        bangbooId={selection.bangbooId}
        stars={selection.bangbooStars}
      />
    </div>
  )
}
