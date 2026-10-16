import {
  render,
  screen,
  userEvent,
  expect,
  it,
  vi,
  AgentDevelopmentGolden,
  workbench,
} from './AgentDevelopmentGolden.workbench.testFixture'
import { WarehouseMatchError } from '../../application/warehouseMatchFeedback'

it('keeps inventory feedback outside the toolbar and opens gaps in the shared popover', async () => {
  const { container } = render(
    <AgentDevelopmentGolden
      workbench={{ ...workbench, hasComparablePlan: false }}
      onAnalyzeWarehouse={vi
        .fn()
        .mockRejectedValue(
          new WarehouseMatchError([
            '当前仓库暂不满足推荐套装与六个号位的组合；请补充以下库存后重新搭配。',
            ...[1, 2, 3, 4, 5, 6].map((slot) => `${slot}号位没有推荐套装的驱动盘。`),
          ]),
        )}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: '比较其他配装' }))
  expect(container.querySelectorAll('.development-disc-card')).toHaveLength(6)
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('当前仓库还不能组成完整配装')
  expect(container.querySelector('.disc-workbench-actions')).not.toContainElement(status)
  const trigger = screen.getByRole('button', { name: '查看缺口' })
  const panel = document.getElementById(trigger.getAttribute('popovertarget')!)!
  expect(panel).toHaveAttribute('aria-label', '仓库配装缺口')
  expect(trigger).toHaveAttribute('popovertarget', panel.id)
  expect(panel).toHaveAttribute('popover', 'auto')
  expect(panel).toHaveTextContent('缺少推荐套装的号位：1–6号。')
  expect(screen.getByRole('link', { name: '查看仓库' })).toHaveAttribute('href', '/assets/discs')
  expect(status.querySelector('details')).toBeNull()
  expect(status).not.toHaveTextContent('1号位没有推荐套装的驱动盘')
})
