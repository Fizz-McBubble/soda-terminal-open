import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { selectDevelopmentSkillTargets } from '../../application/developmentSkillTargetSelection'
import { getProjectedBuildKnowledgeProfile } from '../../gameDataPacks/agentProfile'
import { agentDevelopmentSkillRecommendations } from '../../pages/agentDevelopmentSkillRecommendations'
import { SkillRecommendationTargets } from './SkillRecommendationTargets'

it('keeps all six skill slots in game order without inventing missing targets', () => {
  const { rerender } = render(
    <SkillRecommendationTargets
      mindscape={0}
      skills={[
        { key: 'core', label: '核心技', recommended: '7', targetLevel: 7, priority: true },
        { key: 'basic', label: '普攻', recommended: '12', targetLevel: 12, priority: true },
      ]}
    />,
  )
  const cells = () => [
    ...screen.getByRole('region', { name: '技能推荐等级' }).querySelectorAll('div > span'),
  ]
  expect(cells().map((cell) => cell.querySelector('b')?.textContent)).toEqual([
    '12',
    '待确认',
    '待确认',
    '待确认',
    '待确认',
    '7',
  ])
  expect(cells().filter((cell) => cell.classList.contains('priority'))).toHaveLength(2)
  rerender(<SkillRecommendationTargets skills={[]} mindscape={0} />)
  expect(cells()).toHaveLength(6)
  expect(cells().every((cell) => cell.querySelector('b')?.textContent === '待确认')).toBe(true)
  expect(cells().some((cell) => cell.classList.contains('priority'))).toBe(false)
})

it('shows numeric references and only the explicitly prioritized Aria skill', () => {
  const directions = getProjectedBuildKnowledgeProfile('agent-aria').recommendation!.skillPriority
  const { skills } = agentDevelopmentSkillRecommendations('agent-aria', directions, [])
  render(<SkillRecommendationTargets skills={skills} />)
  const guide = screen.getByRole('region', { name: '技能推荐等级' })
  const cells = [...guide.querySelectorAll('div > span')]
  expect(cells.map((cell) => cell.querySelector('b')?.textContent)).toEqual([
    '11+',
    '7+',
    '9+',
    '9+',
    '11+',
    '7',
  ])
  expect(cells.filter((cell) => cell.classList.contains('priority'))).toHaveLength(3)
  expect(cells[0]).toHaveAttribute('title', expect.stringContaining('参考等级 11+ 级'))
  expect(cells[0]?.getAttribute('title')).not.toContain('优先升级')
  expect(cells[5]).toHaveAttribute('title', expect.stringContaining('优先培养方向；建议练到 7 级'))
})

it('uses one numeric reference style while keeping source floors, targets and derived advice distinct', () => {
  render(
    <SkillRecommendationTargets
      skills={[
        {
          label: '普通攻击',
          recommended: '11+',
          priority: false,
          targetType: 'minimum_reference',
          minimumReference: 11,
          targetLevel: null,
          nextLevel: {
            status: 'unknown',
            tooltip: '实际投入目标待确认，暂不计算下一等级收益。',
            ...{ reasonCode: 'target_level_unknown', fromLevel: 7 },
          },
        },
        {
          label: '核心技',
          recommended: 'F',
          priority: true,
          targetType: 'exact_integer',
          exactTarget: 7,
        },
        {
          label: '支援技',
          recommended: '9',
          priority: false,
          targetType: 'soda_derived',
          targetLevel: 9,
        },
      ]}
    />,
  )
  expect(screen.getByText('11+')).toHaveAttribute(
    'title',
    expect.stringContaining('参考等级 11+ 级'),
  )
  expect(screen.getByText('11+')).toHaveAttribute('title', expect.stringContaining('当前技能 Lv.7'))
  expect(screen.getByText('11+')).not.toHaveAttribute('title', expect.stringContaining('建议练到'))
  expect(screen.getByText('7')).toHaveAttribute('title', expect.stringContaining('建议练到 7 级'))
  expect(screen.getByText('9')).toHaveAttribute('title', expect.stringContaining('培养参考 9 级'))
  expect(screen.getByText('9')).not.toHaveAttribute('title', expect.stringContaining('参考等级'))
  expect(screen.getByRole('button', { name: '培养建议' })).toBeInTheDocument()
  expect(screen.queryByText(/仅来源确认/)).not.toBeInTheDocument()
  expect(screen.queryByText('≥11')).not.toBeInTheDocument()
})

it('keeps a recorded Ye level visible when only the paid target is unknown', () => {
  const context = {
    mindscape: 0,
    skillLevels: { basic: 7, dodge: 7, assist: 7, special: 7, chain: 7, core: 4 },
  }
  const before = JSON.stringify(context)
  const directions =
    getProjectedBuildKnowledgeProfile('agent-ye-shunguang').recommendation!.skillPriority
  const { skills } = agentDevelopmentSkillRecommendations(
    'agent-ye-shunguang',
    directions,
    [],
    context,
  )
  render(<SkillRecommendationTargets skills={skills} />)
  const guide = screen.getByRole('region', { name: '技能推荐等级' })
  const cells = [...guide.querySelectorAll('div > span')]
  expect(cells.map((cell) => cell.querySelector('b')?.textContent)).toEqual([
    '11+',
    '9+',
    '9+',
    '11+',
    '11+',
    '7',
  ])
  expect(cells[0]?.getAttribute('title')).toContain('参考等级 11+ 级')
  expect(cells[0]?.getAttribute('title')).toContain('当前技能 Lv.7')
  expect(cells[0]?.getAttribute('title')).not.toContain('实际投入目标待确认')
  expect(cells[0]?.getAttribute('title')).not.toContain('当前技能等级未记录')
  expect(skills[0]).toMatchObject({
    targetType: 'minimum_reference',
    targetLevel: null,
    minimumReference: 11,
    nextLevel: {
      status: 'unknown',
      reasonCode: 'target_level_unknown',
      fromLevel: 7,
      toLevel: null,
    },
  })
  expect(JSON.stringify(context)).toBe(before)
})

it('asks for a missing current level and preserves a specific mindscape action', () => {
  const context = {
    mindscape: null,
    skillLevels: { basic: null, dodge: 7, assist: 7, special: 7, chain: 7, core: 4 },
  }
  const directions =
    getProjectedBuildKnowledgeProfile('agent-ye-shunguang').recommendation!.skillPriority
  const { skills } = agentDevelopmentSkillRecommendations(
    'agent-ye-shunguang',
    directions,
    [],
    context,
  )
  const { rerender } = render(<SkillRecommendationTargets skills={skills} />)
  expect(screen.getAllByText('11+')[0]).toHaveAttribute(
    'title',
    expect.stringContaining('请录入当前技能等级'),
  )
  const knownTarget = {
    label: '普攻',
    recommended: '12',
    priority: false,
    targetLevel: 12,
    nextLevel: {
      status: 'unknown',
      tooltip: '确认当前影画后重新查看。',
      ...{ reasonCode: 'mindscape_bonus_unknown' },
    },
  }
  rerender(<SkillRecommendationTargets skills={[knownTarget]} />)
  expect(screen.getByText('12')).toHaveAttribute('title', expect.stringContaining('确认当前影画'))
})

it('shows a P6 minimum as an explicit target and distinguishes reached from unmet', () => {
  const selected = selectDevelopmentSkillTargets({
    potential: 6,
    skills: [
      {
        key: 'basic',
        label: '普攻',
        recommended: '11+',
        priority: true,
        targetLevel: null,
      },
    ],
    potentialReference: {
      skillDirections: ['普攻 12+'],
    },
  })
  const { rerender } = render(
    <SkillRecommendationTargets
      skills={selected.skills}
      currentSkills={[{ short: '普', label: '普攻', value: 12 }]}
      mindscape={0}
    />,
  )
  expect(screen.getByText('12')).toHaveAttribute(
    'title',
    expect.stringContaining('当前已达到参考下限 12 级'),
  )
  expect(screen.queryByText('12+')).not.toBeInTheDocument()

  rerender(
    <SkillRecommendationTargets
      skills={selected.skills}
      currentSkills={[{ short: '普', label: '普攻', value: 11 }]}
      mindscape={0}
    />,
  )
  expect(screen.getByText('12')).toHaveAttribute('title', expect.stringContaining('参考等级 12 级'))
  expect(screen.getByText('12')).not.toHaveAttribute(
    'title',
    expect.stringContaining('当前已达到参考下限'),
  )
})

it('keeps the priority background after the target or cap is reached', () => {
  const prompted = {
    label: '核心技',
    recommended: '7级',
    priority: true,
    targetLevel: 7,
    nextLevel: {
      status: 'supported',
      tooltip: '下一级 Lv.4 → Lv.5',
    },
  }
  const achieved = {
    ...prompted,
    nextLevel: {
      status: 'no_upgrade',
      tooltip: '当前等级已达到推荐目标或技能上限。',
    },
  }
  const { rerender } = render(<SkillRecommendationTargets skills={[prompted]} />)
  const cell = () =>
    screen
      .getByRole('region', { name: '技能推荐等级' })
      .querySelector(':scope > div > span:last-child') as HTMLElement

  expect(cell()).toHaveClass('priority')
  expect(cell()).toHaveAttribute('title', expect.stringContaining('优先培养方向'))

  rerender(
    <SkillRecommendationTargets
      skills={[achieved]}
      currentSkills={[{ short: '核', label: '核心', value: 7 }]}
    />,
  )
  const achievedCell = cell()
  expect(achievedCell).toHaveClass('priority')
  expect(achievedCell).toHaveAttribute('title', expect.stringContaining('当前已达到推荐目标 7 级'))
  expect(achievedCell).not.toHaveAttribute('title', expect.stringContaining('先练这项'))
  expect(screen.getByText(/高亮表示这项技能建议练到较高等级。想知道先练哪项/)).toBeInTheDocument()

  rerender(
    <SkillRecommendationTargets
      skills={[{ ...achieved, targetLevel: null }]}
      currentSkills={[{ short: '核', label: '核心', value: 7 }]}
    />,
  )
  expect(cell()).not.toHaveClass('priority')
  expect(cell()).toHaveTextContent('待确认')
  expect(cell()).toHaveAttribute('title', expect.stringContaining('推荐等级待确认'))
  expect(cell()).not.toHaveAttribute('title', expect.stringContaining('达到推荐目标'))

  rerender(<SkillRecommendationTargets skills={[achieved]} />)
  expect(cell()).toHaveClass('priority')
  expect(cell()).toHaveAttribute(
    'title',
    expect.stringContaining('当前无法继续升级，请检查角色等级和技能记录'),
  )

  rerender(
    <SkillRecommendationTargets
      skills={[
        { ...prompted, key: 'core', nextLevel: { status: 'unsupported', tooltip: '资料未齐' } },
      ]}
      currentSkills={[{ short: '核', label: '核心', value: 7 }]}
    />,
  )
  expect(cell()).toHaveClass('priority')
  expect(cell()).toHaveAttribute('title', expect.stringContaining('当前已达到推荐目标'))

  rerender(
    <SkillRecommendationTargets
      skills={[
        {
          ...prompted,
          key: 'core',
          targetLevel: null,
          nextLevel: { status: 'unknown', tooltip: '目标待确认' },
        },
      ]}
      currentSkills={[{ short: '核', label: '核心', value: 7 }]}
    />,
  )
  expect(cell()).not.toHaveClass('priority')
  expect(cell()).toHaveTextContent('待确认')
  expect(cell()).not.toHaveAttribute('title', expect.stringContaining('已达到推荐目标'))
})

it('emphasizes paid investment independently of source rank and cinema bonus', () => {
  const { rerender } = render(
    <SkillRecommendationTargets
      mindscape={3}
      skills={[
        {
          key: 'basic',
          label: '普攻',
          recommended: '14',
          targetLevel: 14,
          baseTargetLevel: 12,
          priority: false,
        },
        {
          key: 'special',
          label: '特殊',
          recommended: '11',
          targetLevel: 11,
          baseTargetLevel: 9,
          priority: true,
        },
        { key: 'core', label: '核心技', recommended: '7', targetLevel: 7, priority: false },
      ]}
    />,
  )
  const cells = () => [
    ...screen.getByRole('region', { name: '技能推荐等级' }).querySelectorAll(':scope > div > span'),
  ]
  expect(cells().map((cell) => cell.classList.contains('priority'))).toEqual([
    true,
    false,
    false,
    false,
    false,
    true,
  ])
  expect(cells()[0]).toHaveAttribute(
    'title',
    expect.stringContaining('基础投入 12 级，已计入影画赠级 2 级'),
  )
  rerender(
    <SkillRecommendationTargets
      mindscape={0}
      skills={[
        { key: 'basic', label: '普攻', recommended: '11', targetLevel: 11, priority: false },
        { key: 'special', label: '特殊', recommended: '12', targetLevel: 12, priority: false },
        { key: 'core', label: '核心技', recommended: '5', targetLevel: 5, priority: true },
      ]}
    />,
  )
  expect(cells().map((cell) => cell.classList.contains('priority'))).toEqual([
    true,
    false,
    false,
    true,
    false,
    false,
  ])
})

it('does not reuse ordinary numbers when a P6 source omits a skill', () => {
  const original = [
    {
      key: 'dodge',
      label: '闪避',
      recommended: '可保持 7',
      targetLevel: 7,
      baseTargetLevel: 7,
      priority: true,
    },
  ]
  const before = JSON.stringify(original)
  const selected = selectDevelopmentSkillTargets({
    potential: 6,
    mindscape: 0,
    skills: original,
    potentialReference: { skillDirections: ['核心技 F'] },
  })
  render(<SkillRecommendationTargets skills={selected.skills} mindscape={0} />)
  expect(screen.getAllByText('待确认')).toHaveLength(6)
  expect(screen.queryByText('7')).not.toBeInTheDocument()
  for (const cell of screen.getAllByText('待确认'))
    expect(cell.closest('span')).not.toHaveClass('priority')
  expect(selected.skills[0]).toMatchObject({
    recommended: '',
    targetLevel: null,
    baseTargetLevel: null,
  })
  expect(JSON.stringify(original)).toBe(before)
})
