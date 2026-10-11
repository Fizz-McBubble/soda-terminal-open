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

it('keeps current equipment visible while compact inventory gaps open on demand', async () => {
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
  expect(screen.getByText('缺少推荐套装的号位：1–6号。')).not.toBeVisible()
  await userEvent.click(screen.getByText('查看缺口'))
  expect(screen.getByText('缺少推荐套装的号位：1–6号。')).toBeVisible()
  expect(status).not.toHaveTextContent('1号位没有推荐套装的驱动盘')
})
