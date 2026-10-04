import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TeamPlanHeader } from './TeamPlanHeader'
import { PlanEditorSavedTeamHeader } from './PlanEditorSavedTeamHeader'

it('uses the same accepted identity layout for current and saved team pages', () => {
  const backButton = createRef<HTMLButtonElement>()
  const heading = createRef<HTMLHeadingElement>()
  const onBack = vi.fn()
  const navigate = vi.fn()
  const name = '测试队伍'
  const teamRatingLabel = '参考评级 A'
  const view = render(
    <TeamPlanHeader
      team={{
        id: 'isolated-team',
        templateId: 'isolated-template',
        agentIds: [],
        title: name,
        coreAgentId: '',
        familyId: '',
        familyKey: '',
        bangbooId: null,
        scenario: null,
        members: [],
        strengthStatus: 'candidate',
        availability: 'direct',
        execution: null,
      }}
      executionPresentation={null}
      headingRef={heading}
      backButtonRef={backButton}
      readOnly={false}
      teamRatingLabel={teamRatingLabel}
      onBack={onBack}
      onReanalyze={vi.fn()}
      onSave={vi.fn()}
    />,
  )
  const acceptedIdentity = view.container.querySelector('.optimizer-plan__team-identity')!.innerHTML
  fireEvent.click(screen.getByRole('button', { name: '返回选择队伍' }))
  expect(onBack).toHaveBeenCalledOnce()
  view.rerender(
    <PlanEditorSavedTeamHeader
      backButton={backButton}
      heading={heading}
      navigate={navigate}
      back="/loadouts/team"
      name={name}
      teamRatingLabel={teamRatingLabel}
      deleteAction={<button type="button">删除方案</button>}
    />,
  )
  expect(view.container.querySelector('.optimizer-plan__team-identity')!.innerHTML).toBe(
    acceptedIdentity,
  )
  expect(backButton.current).toBe(screen.getByRole('button', { name: '返回选择队伍' }))
  expect(heading.current).toBe(screen.getByRole('heading', { level: 1, name }))
  expect(screen.getByText('已保存配装')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除方案' })).toBeInTheDocument()
  expect(screen.queryByText('已保存队伍方案 · 原成员、邦布与驱动盘')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '重新搭配' })).not.toBeInTheDocument()
  fireEvent.click(backButton.current!)
  expect(navigate).toHaveBeenCalledWith('/loadouts/team')
})
