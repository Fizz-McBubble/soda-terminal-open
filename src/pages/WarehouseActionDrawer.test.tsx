import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WarehouseActionItem } from '../application/warehouseActionProjection'
import { sampleDiscs } from '../evaluation/fixtures'
import { WarehouseActionDrawer } from './WarehouseActionDrawer'

const disc = { ...sampleDiscs.treasureCandidate, id: 'drawer-disc' }
function action(overrides: Partial<WarehouseActionItem> = {}): WarehouseActionItem {
  return {
    disc,
    action: 'keep',
    recommendationState: 'current',
    reasons: [],
    statuses: [],
    compatibleAgentIds: [],
    usageAgentIds: [],
    affectedAgentIds: [],
    affectedPlans: [],
    affectedTeams: [],
    alternativeDiscIds: [],
    ...overrides,
  }
}

function drawer(item: WarehouseActionItem) {
  return (
    <WarehouseActionDrawer
      item={item}
      disc={disc}
      discs={[disc]}
      decisionLabel="建议保留"
      relations={[]}
    />
  )
}

describe('warehouse detail density and saved loadout labels', () => {
  it.each([
    ['方案 B', '已保存配装'],
    ['薇薇安 · 方案 B', '薇薇安 · 已保存配装'],
    ['薇薇安 · 方案B（过渡）', '薇薇安 · 已保存配装（过渡）'],
  ])('translates the retired label in %s without changing the saved name', async (name, label) => {
    const item = action({
      affectedPlans: [{ id: 'saved-plan', name, state: 'saved', active: false }],
    })
    const before = structuredClone(item)
    render(drawer(item))
    await userEvent.click(screen.getByRole('button', { name: '1 个关联方案' }))
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.queryByText(name)).not.toBeInTheDocument()
    expect(item).toEqual(before)
  })

  it('preserves custom names and current-plan status', async () => {
    render(
      drawer(
        action({
          affectedPlans: [{ id: 'custom-plan', name: '方案 Beta', state: 'saved', active: true }],
        }),
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: '1 个关联方案' }))
    expect(screen.getByText('方案 Beta')).toBeInTheDocument()
    // jsdom does not implement native popover activation; the browser journey
    // verifies opening, while this assertion checks the linked panel contents.
    expect(screen.getByRole('listitem', { hidden: true })).toHaveTextContent('当前方案')
  })

  it('keeps a no-use decision scoped to the supported account range', () => {
    render(
      drawer(
        action({
          action: 'cleanup',
          reasons: ['当前账号没有适用需求。'],
        }),
      ),
    )
    expect(screen.getByText('当前支持范围与账号范围内未识别到用途。')).toBeInTheDocument()
    expect(screen.queryByText('当前账号没有适用需求。')).not.toBeInTheDocument()
  })

  it('merges a saved plan and its team projection into one usage reference', async () => {
    render(
      drawer(
        action({
          affectedPlans: [{ id: 'saved-team', name: '测试队伍', state: 'saved', active: false }],
          affectedTeams: [
            {
              candidateId: 'candidate-team',
              memberIds: ['agent-billy', 'agent-anby', 'agent-nicole'],
              status: 'ready',
              decisionAuthority: null,
            },
          ],
        }),
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: '1 个关联方案' }))
    const item = within(
      screen.getByLabelText('1 个关联方案', { selector: '[role="dialog"]' }),
    ).getByRole('listitem', { hidden: true })
    expect(item).toHaveTextContent('测试队伍 · 已保存配装')
    expect(item).toHaveTextContent('比利、安比、妮可')
    expect(screen.queryByRole('button', { name: '2 项使用明细' })).not.toBeInTheDocument()
  })

  it('does not present a recovery draft projection as a saved plan', () => {
    render(
      drawer(
        action({
          affectedPlans: [
            { id: 'recovery-cache', name: '恢复缓存', state: 'draft', active: false },
          ],
          affectedTeams: [
            {
              candidateId: 'recovery-cache',
              memberIds: ['agent-billy', 'agent-anby', 'agent-nicole'],
              status: 'needs_confirmation',
              decisionAuthority: null,
            },
          ],
        }),
      ),
    )
    expect(screen.queryByRole('button', { name: /关联方案|使用明细/ })).not.toBeInTheDocument()
  })

  it('summarizes many uses while keeping every role available in the explanation', async () => {
    const ids = ['agent-billy', 'agent-ellen', 'agent-nicole', 'agent-anby']
    render(drawer(action({ retentionAgentIds: ids, compatibleAgentIds: ids })))
    expect(screen.getByLabelText('具体保留用途')).toHaveTextContent('等 4 位')
    expect(screen.getByLabelText('具体保留用途')).not.toHaveTextContent('安比')
    await userEvent.click(screen.getByRole('button', { name: '用途说明' }))
    const trigger = screen.getByRole('button', { name: '用途说明' })
    const panel = document.getElementById(trigger.getAttribute('popovertarget')!)
    expect(panel).toHaveAttribute('role', 'dialog')
    expect(panel).toHaveTextContent('安比')
  })

  it('keeps useful-hit facts without repeating the full-level instruction', () => {
    const item = action({
      developmentAdvice: {
        kind: 'review_finished',
        currentEffectiveRolls: 4,
        optimisticEffectiveRolls: null,
        effectiveAgentId: 'agent-billy',
        remainingNodes: 0,
        nextReviewLevel: null,
        improvingDemandAgentIds: [],
        priority: 4,
      },
    })
    const { rerender } = render(drawer(item))
    const group = screen.getByRole('group', { name: '培养下一步' })
    expect(within(group).queryByText(/已满级/)).not.toBeInTheDocument()
    expect(group).toHaveTextContent('比利 · 4 次有效命中（含初始）')
    rerender(drawer({ ...item, recommendationState: 'stale' }))
    expect(screen.queryByRole('group', { name: '培养下一步' })).not.toBeInTheDocument()
  })

  it('does not repeat identical retention and compatibility lists', () => {
    render(
      drawer(action({ retentionAgentIds: ['agent-billy'], compatibleAgentIds: ['agent-billy'] })),
    )
    expect(screen.getByLabelText('具体保留用途')).toHaveTextContent('保留用途：比利。')
    expect(screen.queryByText('适用角色：比利')).not.toBeInTheDocument()
  })

  it('compares the original and candidate on aligned recorded attributes without a damage claim', () => {
    const candidate = { ...disc, id: 'candidate-disc', level: 6 }
    render(
      <WarehouseActionDrawer
        item={action({ disc: candidate })}
        disc={candidate}
        discs={[disc, candidate]}
        comparisonOrigin={{ item: action(), disc }}
        decisionLabel="继续观察"
        relations={[]}
      />,
    )
    const region = screen.getByRole('region', { name: '原盘与可比较盘属性比较' })
    const table = within(region).getByRole('table')
    expect(table).toHaveTextContent('原盘')
    expect(table).toHaveTextContent('可比较盘')
    expect(table).toHaveTextContent('+15')
    expect(table).toHaveTextContent('+6')
    expect(screen.getByText('只比较记录属性，不代表伤害差距')).toBeInTheDocument()
  })

  it('keeps all comparable discs in one list while retaining disc navigation', () => {
    const alternatives = Array.from({ length: 4 }, (_, index) => ({
      ...disc,
      id: `candidate-${index}`,
      level: index,
    }))
    render(
      <WarehouseActionDrawer
        item={action({ alternativeDiscIds: alternatives.map((item) => item.id) })}
        disc={disc}
        discs={[disc, ...alternatives]}
        decisionLabel="建议保留"
        relations={[]}
        navigation={{ index: 0, total: 2, onPrevious: () => {}, onNext: () => {} }}
      />,
    )
    expect(
      within(screen.getByRole('list', { name: '可比较盘' })).getAllByRole('listitem'),
    ).toHaveLength(4)
    expect(
      within(screen.getByRole('list', { name: '可比较盘' })).getAllByText(/暴击伤害 19.2%/).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('navigation', { name: '可比较盘分页' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上一张' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下一张' })).toBeEnabled()
  })
})
