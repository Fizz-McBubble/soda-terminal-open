import {
  currentPlanningScenarioOptions32,
  planningScenarioSelection32,
  type CurrentPlanningScenarioSelection32,
} from '../application/publicPlanningScenarioContract'
import { PlayerSelect } from './PlayerSelect'
import './planning-scenario-control.css'

export function PlanningScenarioControl({
  value,
  disabled,
  onChange,
}: {
  value: CurrentPlanningScenarioSelection32
  disabled?: boolean
  onChange: (selection: CurrentPlanningScenarioSelection32) => void
}) {
  return (
    <div title="使用相同事件比较配装；失衡期采用1.5倍结算，不代表完整战斗或实战DPS。">
      <PlayerSelect
        aria-label="比较场景"
        className="planning-scenario-control"
        value={value.id}
        disabled={disabled}
        onChange={(id) => onChange(planningScenarioSelection32(id))}
      >
        {currentPlanningScenarioOptions32.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </PlayerSelect>
    </div>
  )
}
