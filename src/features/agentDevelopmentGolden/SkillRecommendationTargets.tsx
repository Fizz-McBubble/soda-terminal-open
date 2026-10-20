import {
  presentationSkillTargetDescription,
  presentationTargetLevel,
} from './agentDevelopmentWorkbenchPresentation'
import type { GoldenWorkbenchData } from './types'

export function SkillRecommendationTargets({
  skills,
}: {
  skills: GoldenWorkbenchData['graduation']['skills']
}) {
  return (
    <section className="skill-comparison__target" aria-label="技能推荐等级">
      <small id="skill-target-title">推荐等级</small>
      <div>
        {skills.map((skill) => (
          <span
            className={skill.priority ? 'priority' : undefined}
            key={skill.label}
            title={presentationSkillTargetDescription(skill)}
          >
            <small>{skill.label}</small>
            <b title={presentationSkillTargetDescription(skill)}>
              {presentationTargetLevel(skill.recommended)}
            </b>
          </span>
        ))}
      </div>
    </section>
  )
}
