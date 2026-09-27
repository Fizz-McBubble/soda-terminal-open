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
// eslint-disable-next-line react-refresh/only-export-components
export { equipmentParameterSelection } from '../application/equipmentParameterSelection'

type EquipmentRecommendations = TargetTeamWarehouseFitQueryResult['equipmentRecommendations']

export function TeamSchemeWEngineControl({
  agentId,
  recommendations,
  selection,
  pending,
  onChange,
}: {
  agentId: string
  recommendations: EquipmentRecommendations
  selection: TargetTeamEquipmentParameterSelection
  pending: boolean
  onChange: (selection: TargetTeamEquipmentParameterSelection) => void
}) {
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
