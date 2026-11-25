import {
  presentationSkillIsHighInvestment,
  presentationSkillNextLevelDetail,
  presentationSkillPriorityLead,
  presentationSkillTargetValue,
} from './agentDevelopmentWorkbenchPresentation'
import type { GoldenWorkbenchData } from './types'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import { getAgentSkillMaxFor } from '../../accounts/agentProgressionRules'
import { workbenchSkillSlots } from './workbenchSkillSlots'

type SkillTarget = GoldenWorkbenchData['graduation']['skills'][number]

const currentSkillLabels: Record<string, string> = {
  basic: '普',
  dodge: '闪',
  assist: '支',
  special: '特',
  chain: '连',
  core: '核',
  普攻: '普',
  普通攻击: '普',
  闪避: '闪',
  支援: '支',
  支援技: '支',
  特殊: '特',
  特殊技: '特',
  连携: '连',
  连携技: '连',
  核心: '核',
  核心技: '核',
}

type SkillProgress = 'achieved' | 'at-cap' | 'no-upgrade-unknown' | 'other'

function playerSkillTargetDescription(skill: SkillTarget, progress: SkillProgress) {
  const value = presentationSkillTargetValue(skill)
  if (value === '待确认')
    return ['当前条件下推荐等级待确认', presentationSkillNextLevelDetail(skill)]
      .filter(Boolean)
      .join('；')
  if (progress === 'achieved') {
    return skill.targetType === 'minimum_reference'
      ? `当前已达到参考下限 ${value} 级`
      : skill.targetType === 'soda_derived'
        ? `已达到培养参考 ${value} 级`
        : `当前已达到推荐目标 ${value} 级`
  }
  if (progress === 'at-cap') return '已达到当前技能上限'
  if (progress === 'no-upgrade-unknown') return '当前无法继续升级，请检查角色等级和技能记录'
  const target =
    skill.targetType === 'minimum_reference'
      ? `参考等级 ${value} 级`
      : skill.targetType === 'soda_derived'
        ? `培养参考 ${value} 级`
        : `建议练到 ${value} 级`
  const base = skill.baseTargetLevel ?? skill.sodaDerived?.baseTargetLevel
  const bonus = base != null && skill.targetLevel != null ? skill.targetLevel - base : 0
  const basis = bonus > 0 ? `基础投入 ${base} 级，已计入影画赠级 ${bonus} 级` : null
  return [
    presentationSkillPriorityLead(skill),
    target,
    basis,
    presentationSkillNextLevelDetail(skill),
  ]
    .filter(Boolean)
    .join('；')
}

export function SkillRecommendationTargets({
  skills,
  currentSkills = [],
  priorityGroups = [],
  mindscape,
}: {
  skills: GoldenWorkbenchData['graduation']['skills']
  currentSkills?: GoldenWorkbenchData['skills']
  priorityGroups?: string[][]
  mindscape?: number
}) {
  const displaySkills: SkillTarget[] = workbenchSkillSlots.map(
    (slot) =>
      skills.find(
        (skill) =>
          (currentSkillLabels[skill.key ?? ''] ?? currentSkillLabels[skill.label]) === slot.short,
      ) ?? { key: slot.key, label: slot.label, recommended: '', priority: false },
  )
  const skillProgress = (skill: SkillTarget): SkillProgress => {
    const short = currentSkillLabels[skill.key ?? ''] ?? currentSkillLabels[skill.label]
    const current = currentSkills.find((item) => item.short === short)?.value
    const validMindscape =
      mindscape != null && Number.isInteger(mindscape) && mindscape >= 0 && mindscape <= 6
    const maximum =
      short === '核' ? 7 : validMindscape ? getAgentSkillMaxFor('basic', mindscape) : null
    const validCurrent =
      current != null &&
      Number.isInteger(current) &&
      current > 0 &&
      maximum != null &&
      current <= maximum
    const target = skill.targetLevel
    if (
      validCurrent &&
      target != null &&
      Number.isInteger(target) &&
      target > 0 &&
      target <= maximum &&
      current >= target
    )
      return 'achieved'
    if (skill.nextLevel?.status === 'no_upgrade') {
      return validCurrent && current === maximum ? 'at-cap' : 'no-upgrade-unknown'
    }
    return 'other'
  }
  return (
    <section className="skill-comparison__target" aria-label="技能推荐等级">
      <header className="skill-comparison__target-heading">
        <small className="skill-comparison__label" id="skill-target-title">
          推荐等级
        </small>
        <ExplanationPopover
          className="skill-comparison__advice"
          label="培养建议"
          title="技能培养建议"
        >
          <p>高亮表示这项技能建议练到较高等级。想知道先练哪项，请看各技能的培养建议。</p>
          {priorityGroups.length > 0 && (
            <p className="skill-comparison__priority-order">
              <span>升级顺序：</span>
              {priorityGroups.map((group, index) => (
                <span className="skill-comparison__priority-group" key={group.join('-')}>
                  {index > 0 ? <span aria-hidden="true">→</span> : null}
                  <span>{group.join(' / ')}</span>
                </span>
              ))}
            </p>
          )}
          <dl className="skill-comparison__advice-list">
            {displaySkills.map((skill) => (
              <div key={skill.label}>
                <dt>{skill.label}</dt>
                <dd>{playerSkillTargetDescription(skill, skillProgress(skill))}</dd>
              </div>
            ))}
          </dl>
        </ExplanationPopover>
      </header>
      <div>
        {displaySkills.map((skill) => (
          <span
            className={presentationSkillIsHighInvestment(skill, mindscape) ? 'priority' : undefined}
            key={skill.label}
            title={playerSkillTargetDescription(skill, skillProgress(skill))}
          >
            <small>{skill.label}</small>
            <b title={playerSkillTargetDescription(skill, skillProgress(skill))}>
              {presentationSkillTargetValue(skill)}
            </b>
          </span>
        ))}
      </div>
    </section>
  )
}
