import { useId } from 'react'
import type { AgentDevelopmentGoldenProps, GoldenWorkbenchData } from './types'
import { selectDevelopmentSkillTargets } from '../../application/developmentSkillTargetSelection'
import { SkillRecommendationTargets } from './SkillRecommendationTargets'
import { WorkbenchEnginePlan } from './WorkbenchEnginePlan'
import { WorkbenchPanelSnapshot } from './WorkbenchPanelSnapshot'
import { workbenchSkillSlots } from './workbenchSkillSlots'
import { VisualEntityImage } from '../../components/VisualEntityImage'
import { getVisualAsset } from '../../assets/visualAssets'
import './WorkbenchCurrentOverview.css'

export function WorkbenchCurrentOverview({
  subject,
  onEditCurrent,
  currentUpdate,
  comparisonConditions,
}: {
  subject: GoldenWorkbenchData
  onEditCurrent?: () => void
  currentUpdate?: AgentDevelopmentGoldenProps['currentUpdate']
  comparisonConditions?: AgentDevelopmentGoldenProps['workbenchComparisonConditions']
}) {
  const skillInkFilterId = useId()
  const skillTargetPresentation = selectDevelopmentSkillTargets({
    potential: subject.potential,
    mindscape: subject.mindscape,
    skills: subject.graduation.skills,
    potentialReference: subject.graduation.potentialSkillReference,
    priorityGroups: subject.graduation.skillPriorityGroups,
  })
  return (
    <section className="current-overview" aria-label="当前状态与属性面板">
      <section className="current-overview__state" aria-labelledby="current-title">
        <header>
          <div>
            <h2 id="current-title">当前状态</h2>
          </div>
          <div className="current-state-actions">
            <span className="account-fact current-level-fact">
              <b>
                Lv.{subject.level} · {subject.mindscape} 影
                {subject.supportsPotential &&
                  ` · ${subject.potential == null ? '潜能未记录' : `潜能 ${subject.potential}`}`}
              </b>
            </span>

            <button
              type="button"
              className="edit-current"
              onClick={onEditCurrent}
              disabled={!onEditCurrent}
            >
              编辑当前状态
            </button>
          </div>
        </header>
        <div className="current-status-details">
          <div className="skill-comparison" aria-label="技能等级与培养建议">
            <svg className="sr-only" aria-hidden="true">
              <defs>
                <filter id={skillInkFilterId} colorInterpolationFilters="sRGB">
                  {/* Keep the bright game glyph and the PNG's original transparency. */}
                  <feColorMatrix type="luminanceToAlpha" />
                  <feComposite in2="SourceAlpha" operator="in" result="glyph" />
                  <feFlood floodColor="var(--soda-accent)" />
                  <feComposite in2="glyph" operator="in" />
                </filter>
              </defs>
            </svg>
            <div className="skill-comparison__current">
              <small className="skill-comparison__label">当前技能</small>
              <div>
                {workbenchSkillSlots.map(({ key, short, label }) => {
                  const skill = subject.skills.find((entry) => entry.short === short)
                  const iconId = `skill-${key}`
                  return (
                    <span key={key} data-skill={key}>
                      <small className="skill-comparison__skill-label" title={label}>
                        {getVisualAsset('illustration', iconId, 'icon') && (
                          <span
                            className="skill-comparison__skill-icon"
                            aria-hidden="true"
                            style={{ filter: `url("#${skillInkFilterId}")` }}
                          >
                            <VisualEntityImage
                              entityType="illustration"
                              entityId={iconId}
                              name={label}
                              slotId="skill.category-icon"
                              consumer="agent-development.workbench"
                            />
                          </span>
                        )}
                        <span className="skill-comparison__skill-fallback" aria-hidden="true">
                          {short}
                        </span>
                        <span className="sr-only">{label}</span>
                      </small>
                      <b>{skill?.value ?? '—'}</b>
                    </span>
                  )
                })}
              </div>
            </div>
            <SkillRecommendationTargets
              skills={skillTargetPresentation.skills}
              priorityGroups={skillTargetPresentation.priorityGroups}
              currentSkills={subject.skills}
              mindscape={subject.mindscape}
            />
            <div className="current-status-feedback">
              {currentUpdate ? (
                <span
                  className="current-update-status"
                  role={currentUpdate.tone === 'failed' ? 'alert' : 'status'}
                >
                  <span>{currentUpdate.message}</span>
                  {currentUpdate.onRetry && (
                    <button
                      type="button"
                      className="button button--quiet"
                      onClick={currentUpdate.onRetry}
                    >
                      重试
                    </button>
                  )}
                </span>
              ) : null}
            </div>
          </div>
          <WorkbenchEnginePlan subject={subject} />
        </div>
      </section>
      <WorkbenchPanelSnapshot subject={subject} comparisonConditions={comparisonConditions} />
    </section>
  )
}
