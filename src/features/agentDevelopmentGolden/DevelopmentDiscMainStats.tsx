import { ExplanationPopover } from '../../components/ExplanationPopover'
import { playerConditionLines } from '../../application/playerDecisionPresentation'
import { DevelopmentDirectionAction } from './DevelopmentDirectionAction'
import { workbenchPanelConditionPresentation } from './workbenchPanelConditions'
import type { GoldenWorkbenchData } from './types'

type DiscGuide = GoldenWorkbenchData['graduation']['discs']
const purposes = {
  transition: '过渡',
  personal_damage: '自身输出',
  anomaly_support: '异常支援',
  short_fight: '短战斗',
  secondary: '备选',
} as const

/** Conditional choices stay beside their slot, outside common eligibility. */
export function DevelopmentDiscMainStats({
  mainStats,
  alternatives,
  groupKey,
  onSelectDirection,
}: {
  mainStats: DiscGuide['mainStats']
  alternatives: NonNullable<DiscGuide['mainStatAlternatives']>
  groupKey: string | undefined
  onSelectDirection?: (directionId: string) => void | Promise<void>
}) {
  return (
    <dl className="loadout-main-stat-priority" aria-label="4、5、6号位主词条建议">
      {mainStats.map((stat) => {
        const choices = alternatives.filter((entry) => `${entry.slot}号位` === stat.slot)
        return (
          <div key={stat.slot}>
            <dt>{stat.slot}</dt>
            <dd>
              {stat.value.split(/\s*\/\s*/).map((value, index) => (
                <span className="disc-guide__main-stat" key={value}>
                  {index > 0 ? ' / ' : ''}
                  {value}
                </span>
              ))}
            </dd>
            {choices.length ? (
              <ExplanationPopover
                key={`${groupKey}-${stat.slot}`}
                label="选用条件"
                triggerAriaLabel={`${stat.slot}选用条件`}
                title={`${stat.slot}主词条选择`}
              >
                {choices.map((alternative) => (
                  <section key={alternative.sourceId} data-main-stat-source={alternative.sourceId}>
                    <strong>
                      {alternative.stats.join(' / ')}
                      {alternative.purpose === 'secondary'
                        ? ''
                        : ` · ${purposes[alternative.purpose]}`}
                    </strong>
                    <p>
                      {
                        playerConditionLines(
                          workbenchPanelConditionPresentation([alternative.condition]),
                        )[0]?.text
                      }
                    </p>
                    {alternative.directionId && onSelectDirection ? (
                      <DevelopmentDirectionAction
                        key={alternative.directionId}
                        directionId={alternative.directionId}
                        onSelect={onSelectDirection}
                      />
                    ) : null}
                  </section>
                ))}
              </ExplanationPopover>
            ) : null}
          </div>
        )
      })}
    </dl>
  )
}
