import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { TestingBadge } from './TestingBadge'
import { F5VisualShell } from './F5VisualShell'

vi.mock('./SponsorSupport', () => ({
  SponsorProvider: ({ children }: { children: React.ReactNode }) => children,
  SponsorRail: () => null,
}))
vi.mock('./ReleaseNotes', () => ({ ReleaseNotes: () => null }))

it.each([
  ['box', '说明', '队伍建议使用说明', '不同副本的敌人、增益和实战表现'],
  ['discs', '说明', '驱动盘建议使用说明', '评价分不等于实际伤害收益'],
  ['quickRead', '测试版', '资产快读测试版说明', '没有读到的内容保留原值'],
] as const)(
  'explains the scope of %s through a compact native disclosure',
  (scope, visibleLabel, accessibleLabel, text) => {
    render(<TestingBadge scope={scope} />)
    const trigger = screen.getByRole('button', { name: accessibleLabel })
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(trigger).toHaveTextContent(visibleLabel)
    expect(dialog).toHaveAttribute('aria-label', accessibleLabel)
    expect(trigger).toHaveAttribute('popovertarget', dialog.id)
    expect(trigger.querySelector('[aria-hidden]')).toBeNull()
    expect(dialog).toHaveAttribute('popover', 'auto')
    expect(dialog).toHaveTextContent(text)
    expect(within(dialog).getByRole('button', { name: '关闭说明', hidden: true })).toHaveAttribute(
      'popovertargetaction',
      'hide',
    )
  },
)

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>
}

it('keeps sidebar help controls outside links and does not navigate or dismiss on click', () => {
  const closeSidebar = vi.fn()
  render(
    <MemoryRouter initialEntries={['/development']}>
      <F5VisualShell
        currentPath="/development"
        currentTitle="养成"
        currentVersion="3.2"
        account={{
          hydrating: false,
          status: 'ready',
          name: '',
          agentCount: 0,
          discCount: 0,
          hasAccount: false,
        }}
        systemStatus="ready"
        sidebarOpen={false}
        closeSidebar={closeSidebar}
        toggleSidebar={() => {}}
        isPrimaryCurrent={() => false}
      >
        <CurrentPath />
      </F5VisualShell>
    </MemoryRouter>,
  )
  const nav = screen.getByRole('navigation', { name: '主导航' })
  expect(nav.querySelector('a button')).toBeNull()
  for (const badge of [
    within(nav).getByRole('button', { name: '队伍建议使用说明' }),
    within(nav).getByRole('button', { name: '驱动盘建议使用说明' }),
  ]) {
    expect(badge).toHaveTextContent('说明')
    badge.focus()
    expect(badge).toHaveFocus()
    fireEvent.click(badge)
    expect(screen.getByTestId('current-path')).toHaveTextContent('/development')
  }
  expect(closeSidebar).not.toHaveBeenCalled()
  expect(nav.querySelectorAll('a')).toHaveLength(6)
})
