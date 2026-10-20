import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { getProjectedBuildKnowledgeProfile } from '../../gameDataPacks/agentProfile'
import { agentDevelopmentSkillRecommendations } from '../../pages/agentDevelopmentSkillRecommendations'
import { SkillRecommendationTargets } from './SkillRecommendationTargets'

it('shows numeric references and only the source-confirmed Aria priority', () => {
  const directions = getProjectedBuildKnowledgeProfile('agent-aria').recommendation!.skillPriority
  const { skills } = agentDevelopmentSkillRecommendations('agent-aria', directions, [])
  render(<SkillRecommendationTargets skills={skills} />)
  const guide = screen.getByRole('region', { name: '技能推荐等级' })
  const cells = [...guide.querySelectorAll('div > span')]
  expect(cells.map((cell) => cell.querySelector('b')?.textContent)).toEqual([
    '11',
    '7',
    '9',
    '9',
    '11',
    '7',
  ])
  expect(cells.filter((cell) => cell.classList.contains('priority'))).toHaveLength(1)
  expect(cells[0]).toHaveAttribute('title', expect.stringContaining('推荐等级：11级'))
  expect(cells[0]?.getAttribute('title')).not.toContain('优先升级')
  expect(cells[5]).toHaveAttribute('title', expect.stringContaining('优先升级；推荐等级：7级'))
})
