import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WarehouseActionItem } from '../application/warehouseActionProjection'
import { action, disc, drawer } from './warehouseActionDrawerTestFixture'
import { WarehouseActionDrawer } from './WarehouseActionDrawer'
import { evidence, matchingRetentionUse } from './WarehouseRetentionEvidence.testFixture'

it.each([
  ['Experimental', '暂时无法判断这队的强弱'],
  ['A', '评级 A'],
])('uses the shared team-strength meaning for warehouse impact %s', (band, label) => {
  render(
    drawer(
      action({
        affectedTeams: [
          {
            candidateId: 'semantic-team',
            memberIds: ['agent-claret', 'agent-rina', 'agent-roxy'],
            status: 'ready',
            decisionAuthority: {
              teamRating: band,
              confidence: 'low',
              cultivationPriority: 'experimental',
            },
          },
        ],
      }),
    ),
  )
  const impact = screen.getByRole('heading', { name: '队伍影响' }).parentElement!
  expect(impact).toHaveTextContent(label)
  expect(impact).not.toHaveTextContent('Experimental')
})

describe('warehouse detail density and saved loadout labels', () => {
  it('shows the selected set effects before disc stats', () => {
    const selected = { ...disc, setId: 'set-34100' }
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({ disc: selected })}
        disc={selected}
        discs={[selected]}
        decisionLabel="继续观察"
        relations={[]}
      />,
    )
    const effect = screen.getByRole('region', { name: '套装效果' })
    expect(effect).toHaveTextContent('异常精通提升30点')
    expect(
      effect.compareDocumentPosition(screen.getByRole('region', { name: '当前盘词条' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
  it('omits the duplicate usage section from the detail card', () => {
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({ usageAgentIds: ['agent-anby'] })}
        disc={disc}
        discs={[disc]}
        decisionLabel="建议保留"
        relations={['当前使用', '已标记保留']}
      />,
    )
    expect(screen.queryByRole('heading', { name: '使用情况' })).not.toBeInTheDocument()
    expect(screen.queryByText('当前使用')).not.toBeInTheDocument()
    expect(screen.queryByText('尚未记录角色或方案使用。')).not.toBeInTheDocument()
  })
  it('replaces an old mismatched witness with a safe reanalysis action', () => {
    const badUse = {
      ...matchingRetentionUse(disc.setId, 'wrong-set', 70),
      branchSetPlan: {
        pattern: '2+2+2' as const,
        primarySetIds: ['other-set'],
        secondarySetIds: [],
      },
    }
    const reanalyze = vi.fn()
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({
          action: 'cleanup',
          nextStep: { kind: 'manual_cleanup', targetLevel: null, detail: '清理' },
          absoluteRetention: evidence({ witnessProfileIds: ['wrong-set'], leadingUses: [badUse] }),
        })}
        disc={disc}
        discs={[disc]}
        decisionLabel="建议清理"
        relations={[]}
        onReanalyze={reanalyze}
      />,
    )
    expect(screen.getByLabelText('当前建议与下一步')).toHaveTextContent('先保留，暂不继续强化')
    expect(screen.queryByLabelText('清理候选的核对范围')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /查看安比的词条匹配/ })).not.toBeInTheDocument()
    screen.getByRole('button', { name: '重新分析' }).click()
    expect(reanalyze).toHaveBeenCalledOnce()
  })
  it('presents one decision and reason with the matching score available from the applicable agent', async () => {
    render(
      drawer(
        action({
          nextStep: { kind: 'review_quality', targetLevel: null, detail: '内部步骤。' },
          absoluteRetention: evidence({
            leadingUses: [matchingRetentionUse(disc.setId, 'example', 70)],
          }),
        }),
      ),
    )
    const reason = '当前词条在边界，先保留；没有明确目标时不继续强化。'
    expect(screen.getAllByText(reason)).toHaveLength(1)
    expect(screen.queryByText('当前建议的依据')).not.toBeInTheDocument()
    expect(screen.queryByText('内部步骤。')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '适用角色' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /安比/ }))
    const dialog = screen.getByRole('dialog', { name: /安比/ })
    expect(within(dialog).getByRole('group', { name: '词条匹配' })).toBeVisible()
    expect(within(dialog).getByText('42.0 分')).toBeVisible()
    expect(
      within(dialog).queryByText('按该角色用途所需副词条及强化次数计算。'),
    ).not.toBeInTheDocument()
  })

  it('keeps recommendation, evidence, facts and comparison in one readable order', () => {
    render(
      drawer(
        action({
          nextStep: { kind: 'keep', targetLevel: null, detail: '当前用途需要保留。' },
          absoluteRetention: evidence({
            leadingUses: [matchingRetentionUse(disc.setId, 'ordered-use', 70)],
          }),
        }),
      ),
    )
    const decision = screen.getByLabelText('当前建议与下一步')
    const facts = screen.getByLabelText('当前盘词条')
    const comparison = screen.getByRole('heading', { name: '其他用途与比较' }).parentElement!
    const useButton = screen.getByRole('button', { name: /安比/ })
    expect(decision.parentElement).toHaveClass('warehouse-action-drawer__decision-stack')
    expect(facts.compareDocumentPosition(decision) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      decision.compareDocumentPosition(useButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      facts.compareDocumentPosition(comparison) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(useButton).toHaveClass('button', 'button--quiet', 'warehouse-retention__agent')
    expect(useButton).toHaveAttribute('aria-controls')
  })

  it('distinguishes recorded differences from a missing side without interpreting missing attributes as zero', () => {
    const candidate = { ...disc, id: 'comparison-missing-stat', level: 6, subStats: [] }
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({ disc: candidate })}
        disc={candidate}
        discs={[disc, candidate]}
        comparisonOrigin={{ item: action(), disc }}
        decisionLabel="继续观察"
        relations={[]}
      />,
    )
    const table = screen.getByRole('region', { name: '原盘与可比较盘属性比较' })
    expect(within(table).getAllByText('有差异').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('单侧未记录')).toHaveLength(disc.subStats.length)
    expect(
      within(table)
        .getAllByRole('cell')
        .filter((cell) => cell.textContent === '—'),
    ).toHaveLength(disc.subStats.length)
    expect(table).toHaveTextContent('单侧未记录')
    expect(table).toHaveTextContent('有差异')
  })
  it('keeps the final protection action ahead of independent quality evidence', () => {
    render(
      drawer(
        action({
          statuses: ['saved_plan_reference'],
          nextStep: { kind: 'keep', targetLevel: null, detail: '已保存方案需要这张盘。' },
          finalRecommendation: { action: 'keep', state: 'current', basis: 'explicit_protection' },
          absoluteRetention: evidence({
            disposition: 'cleanup_candidate',
            reasonKind: 'proven_low_ceiling',
          }),
        }),
      ),
    )
    expect(screen.getByLabelText('当前建议与下一步')).toHaveTextContent('保留')
    expect(screen.getByText('查看词条分析说明')).toBeVisible()
    expect(screen.queryByRole('heading', { name: '当前建议的依据' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('尚未记录角色或方案使用。')).not.toBeInTheDocument()
  })

  it('preserves the historical favorite as a protection reason', () => {
    render(
      drawer(
        action({
          statuses: ['favorite'],
          reasons: ['已收藏，按明确保留意图保护。'],
          nextStep: {
            kind: 'keep',
            targetLevel: null,
            detail: '已收藏，按明确保留意图保护。',
            stopWhen: '移除收藏后重新分析。',
          },
          finalRecommendation: { action: 'keep', state: 'current', basis: 'explicit_protection' },
          absoluteRetention: evidence(),
        }),
      ),
    )
    expect(screen.getByLabelText('当前建议与下一步')).toHaveTextContent('已标记保留')
    expect(document.body).not.toHaveTextContent('收藏')
    expect(screen.getByLabelText('当前建议与下一步')).toHaveTextContent('保留')
  })

  it('keeps actual equipment or saved-plan protection without repeating retired collection copy', () => {
    render(
      drawer(
        action({
          statuses: ['currently_equipped', 'favorite'],
          usageAgentIds: ['agent-billy'],
          nextStep: {
            kind: 'keep',
            targetLevel: null,
            detail: '按收藏、实装或保存方案等明确保护记录保留此盘。',
            stopWhen: '保护记录移除后重新分析。',
          },
          finalRecommendation: { action: 'keep', state: 'current', basis: 'explicit_protection' },
        }),
      ),
    )
    const decision = screen.getByLabelText('当前建议与下一步')
    expect(decision).toHaveTextContent('保留')
    expect(decision).toHaveTextContent('这张盘已被装备或方案使用')
    expect(decision).not.toHaveTextContent('收藏')
    expect(document.body).not.toHaveTextContent('收藏')
  })

  it('puts stale reanalysis at the decision and does not repeat the expired completion step', async () => {
    const onReanalyze = vi.fn()
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({
          recommendationState: 'stale',
          nextStep: {
            kind: 'complete_data',
            targetLevel: null,
            detail: '补齐资料后再判断。',
          },
        })}
        disc={disc}
        discs={[disc]}
        decisionLabel="建议保留"
        relations={[]}
        onReanalyze={onReanalyze}
      />,
    )
    const decision = screen.getByLabelText('当前建议与下一步')
    expect(decision).toHaveTextContent('建议待更新')
    expect(decision).toHaveTextContent('当前建议已失效')
    expect(decision).toHaveTextContent('按当前角色和装备更新建议')
    expect(decision).not.toHaveTextContent('先补齐判断所需资料')
    expect(
      screen.queryByText('该结论已过期，仅供回看；请重新分析后再判断。'),
    ).not.toBeInTheDocument()
    await userEvent.click(within(decision).getByRole('button', { name: '重新分析' }))
    expect(onReanalyze).toHaveBeenCalledOnce()
  })

  it('offers recovery for a stale legacy result without a next step', async () => {
    const onReanalyze = vi.fn()
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({ recommendationState: 'stale' })}
        disc={disc}
        discs={[disc]}
        decisionLabel="建议保留"
        relations={[]}
        onReanalyze={onReanalyze}
      />,
    )
    const decision = screen.getByLabelText('当前建议与下一步')
    expect(decision).toHaveTextContent('当前建议已失效')
    await userEvent.click(within(decision).getByRole('button', { name: '重新分析' }))
    expect(onReanalyze).toHaveBeenCalledOnce()
  })

  it('retains the manual cleanup warning when the assessment details are missing', () => {
    render(drawer(action({ action: 'cleanup' })))
    const decision = screen.getByLabelText('当前建议与下一步')
    expect(decision).toHaveTextContent('继续观察')
    expect(decision).toHaveTextContent('先保留')
    expect(screen.queryByRole('button', { name: /删除驱动盘/ })).not.toBeInTheDocument()
  })

  it('does not offer cleanup for an inconsistent old result with a favorite record', () => {
    render(
      drawer(
        action({
          action: 'cleanup',
          cleanupAssessment: {
            favorite: true,
            equipped: false,
            referenced: false,
          } as WarehouseActionItem['cleanupAssessment'],
        }),
      ),
    )
    expect(screen.queryByLabelText('清理候选的核对范围')).not.toBeInTheDocument()
    expect(screen.getByLabelText('当前建议与下一步')).toHaveTextContent('已标记保留')
    expect(document.body).not.toHaveTextContent('收藏')
    expect(screen.getByLabelText('当前建议与下一步')).toHaveTextContent('建议保留')
  })

  it('renders the main stat once and substats as aligned peer items', () => {
    render(drawer(action()))
    const keyFacts = screen.getByLabelText('当前盘词条')
    expect(keyFacts.querySelector('.warehouse-action-drawer__main-stat')).not.toBeNull()
    expect(keyFacts.querySelectorAll('.warehouse-action-drawer__main-stat')).toHaveLength(1)
    expect(keyFacts.querySelectorAll('.warehouse-action-drawer__main-stat-list')).toHaveLength(1)
    expect(keyFacts.querySelectorAll('.warehouse-action-drawer__substats')).toHaveLength(1)
    expect(keyFacts.querySelectorAll('.warehouse-action-drawer__substat')).toHaveLength(
      disc.subStats.length,
    )
    expect(keyFacts.querySelectorAll('.warehouse-action-drawer__substat-value')).toHaveLength(
      disc.subStats.length,
    )
    expect(keyFacts.querySelectorAll('.warehouse-action-drawer__substat-enhancement')).toHaveLength(
      disc.subStats.length,
    )
    expect(keyFacts).toHaveTextContent('强化 3 次')
    expect(keyFacts).not.toHaveTextContent('19.2% · 强化 3 次')
  })

  it('keeps enhancement counts unknown when the recorded history is inconsistent', () => {
    const unknown = {
      ...disc,
      id: 'unknown-substat-history',
      level: 15 as const,
      subStats: disc.subStats.slice(0, 3),
    }
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({ disc: unknown })}
        disc={unknown}
        discs={[unknown]}
        decisionLabel="继续观察"
        relations={[]}
      />,
    )
    const keyFacts = screen.getByLabelText('当前盘词条')
    expect(keyFacts.querySelectorAll('.warehouse-action-drawer__substat-value')).toHaveLength(3)
    expect(keyFacts.querySelectorAll('.warehouse-action-drawer__substat-enhancement')).toHaveLength(
      0,
    )
    expect(keyFacts).not.toHaveTextContent(/强化 [0-9]+ 次/)
  })

  it('drops generic engineering stop copy while retaining a concrete trial stop condition', () => {
    const { rerender } = render(
      drawer(
        action({
          nextStep: {
            kind: 'keep',
            targetLevel: null,
            detail: '已有实际用途。',
            stopWhen: '阶段结构不达标时停止。',
          },
        }),
      ),
    )
    expect(screen.queryByText('停止条件')).not.toBeInTheDocument()
    rerender(
      drawer(
        action({
          nextStep: {
            kind: 'try_upgrade',
            targetLevel: 3,
            detail: '只建议试到 +3。',
            stopWhen: '阶段结构不达标时停止。',
          },
        }),
      ),
    )
    expect(screen.getByText('先强化到 +3，再看结果')).toBeVisible()
    expect(screen.getByText('强化后重新分析；没有改善就停手。')).toBeVisible()
  })

  it('labels an unproved same-kind comparison without claiming replacement', async () => {
    const candidate = { ...disc, id: 'unproved-same-kind' }
    const onSelectAlternative = vi.fn()
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action()}
        disc={disc}
        discs={[disc, candidate]}
        decisionLabel="建议保留"
        relations={[]}
        onSelectAlternative={onSelectAlternative}
      />,
    )
    const summary = screen.getByRole('button', { name: /^展开.*驱动盘卡/ })
    expect(screen.getByRole('list', { name: '可比较盘' })).toBeVisible()
    expect(document.querySelector('.development-disc-card')).not.toBeInTheDocument()
    await userEvent.click(summary)
    expect(document.querySelector('.development-disc-card')).toBeVisible()
    expect(onSelectAlternative).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: '查看盘详情' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '对比这张盘' }))
    expect(onSelectAlternative).toHaveBeenCalledWith(candidate.id)
    expect(screen.queryByRole('button', { name: /替代盘/ })).not.toBeInTheDocument()
  })
  it('distinguishes scored reference uses from the broader retention-potential list', async () => {
    const ids = ['agent-anby', 'agent-billy', 'agent-nicole', 'agent-lycaon']
    render(
      drawer(
        action({
          absoluteRetention: evidence({
            unownedUseAgentIds: ids,
            ownedUseAgentIds: [],
            leadingUses: [matchingRetentionUse(disc.setId, 'selected-reference', 80, 65)],
          }),
          compatibleAgentIds: ids,
        }),
      ),
    )
    expect(screen.getByRole('heading', { name: '适用角色' })).toBeVisible()
    expect(
      within(screen.getByRole('list', { name: '适用角色' })).getAllByRole('listitem'),
    ).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: '用途说明' }))
    const trigger = screen.getByRole('button', { name: '用途说明' })
    const panel = document.getElementById(trigger.getAttribute('popovertarget')!)
    expect(panel).toHaveAttribute('role', 'dialog')
    expect(panel).toHaveTextContent('同类盘的套装、号位和主词条相同')
    expect(panel).toHaveTextContent('列表还包含替换盘和强化后可比较的盘')
    expect(panel).not.toHaveTextContent(/保留潜力：.*妮可.*莱卡恩/)
    expect(screen.queryByText(/^适用角色：/)).not.toBeInTheDocument()
  })
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
          cleanupAssessment: {
            equipped: false,
            referenced: false,
            activePlanReferenced: false,
            savedPlanReferenced: false,
            portfolioReferenced: false,
            protectedDemandCount: 0,
            protectedDemandCoverageComplete: true,
            protectedDemandReferencesResolved: true,
            physicalCopyCount: 2,
            availableCopiesAfterDelete: 1,
            deleteAfterFeasible: true,
            hasBetterAlternative: true,
            hasCoverageAlternative: true,
            rareUnique: false,
            significantFit: false,
            alternativeSafe: true,
            complete: true,
            potentialEvaluated: true,
            optimisticCeilingDominated: true,
            noCurrentAccountFit: true,
            nonViableEmbryo: true,
            badEmbryoCleanupSafe: true,
            cleanupEvidenceComplete: true,
            adoptedSetIdentity: true,
          },
        }),
      ),
    )
    expect(screen.getByText('当前账户记录中没有找到适用用途。')).toBeInTheDocument()
    expect(screen.queryByText('当前账号没有适用需求。')).not.toBeInTheDocument()
  })

  it('merges a saved plan and its team projection into one usage reference', async () => {
    render(
      drawer(
        action({
          affectedPlans: [{ id: 'saved-team', name: '测试队伍', state: 'saved', active: false }],
          affectedTeams: [
            {
              planId: 'saved-team',
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

  it('keeps separately saved plays with identical members and joins by plan id after reordering', async () => {
    const members: [string, string, string] = ['agent-miyabi', 'agent-astra', 'agent-nangong']
    const plans = ['直伤', '异常'].map((name) => ({
      id: name,
      name,
      state: 'saved' as const,
      active: false,
      memberIds: members,
    }))
    const teams = [...plans].reverse().map((plan) => ({
      planId: plan.id,
      candidateId: 'same-candidate',
      memberIds: members,
      status: 'ready' as const,
      decisionAuthority: {
        teamRating: 'A',
        confidence: 'high',
        cultivationPriority: plan.id === '直伤' ? 'ready_now' : 'short_upgrade',
      },
    }))
    render(drawer(action({ affectedPlans: [...plans, plans[0]!], affectedTeams: teams })))
    await userEvent.click(screen.getByRole('button', { name: '2 个关联方案' }))
    const items = within(
      screen.getByLabelText('2 个关联方案', { selector: '[role="dialog"]' }),
    ).getAllByRole('listitem', { hidden: true })
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('直伤 · 已保存配装 · 星见雅、耀嘉音、南宫羽 · 现在可用')
    expect(items[1]).toHaveTextContent('异常 · 已保存配装 · 星见雅、耀嘉音、南宫羽 · 短期补强')
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
        ownedAgentIds={new Set()}
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
    expect(table).toHaveTextContent('身份')
    expect(table).toHaveTextContent('主词条')
  })

  it('opens one comparison entry with every same-kind disc while retaining disc navigation', async () => {
    const alternatives = Array.from({ length: 4 }, (_, index) => ({
      ...disc,
      id: `candidate-${index}`,
      level: index,
    }))
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({ alternativeDiscIds: [alternatives[0]!.id] })}
        disc={disc}
        discs={[disc, ...alternatives]}
        decisionLabel="建议保留"
        relations={[]}
        navigation={{ index: 0, total: 2, onPrevious: () => {}, onNext: () => {} }}
      />,
    )
    expect(screen.queryByRole('button', { name: /查看全部/ })).not.toBeInTheDocument()
    const list = screen.getByRole('list', { name: '可比较盘' })
    expect(list).toBeVisible()
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    expect(within(list).getAllByText(/暴击伤害 19.2%/).length).toBeGreaterThan(0)
    await userEvent.click(within(list).getAllByRole('button', { name: /^展开.*驱动盘卡/ })[0]!)
    expect(document.querySelector('.development-disc-card')).toBeVisible()
    expect(screen.queryByRole('navigation', { name: '可比较盘分页' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上一张' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下一张' })).toBeEnabled()
  })

  it('stably renumbers same-kind comparison rows in display order while excluding the original', () => {
    const original = { ...disc, id: 'z-original' }
    const cleanup = { ...disc, id: 'b-cleanup', level: 4 }
    const middle = { ...disc, id: 'm-middle', level: 7 }
    const kept = { ...disc, id: 'y-kept', level: 12 }
    const recommendations = new Map([
      [kept.id, { label: '建议保留', prioritize: true }],
      [cleanup.id, { label: '可考虑清理', prioritize: false }],
      [middle.id, { label: '继续观察', prioritize: false }],
    ])
    render(
      <WarehouseActionDrawer
        ownedAgentIds={new Set()}
        item={action({ disc: original, alternativeDiscIds: [cleanup.id, middle.id, kept.id] })}
        disc={original}
        discs={[original, cleanup, middle, kept]}
        decisionLabel="建议保留"
        relations={[]}
        alternativeRecommendations={recommendations}
        onSelectAlternative={() => {}}
      />,
    )
    const list = screen.getByRole('list', { name: '可比较盘' })
    const rows = within(list).getAllByRole('listitem')
    expect(
      rows.map((row) =>
        row.querySelector('[data-alternative-id]')?.getAttribute('data-alternative-id'),
      ),
    ).toEqual([kept.id, cleanup.id, middle.id])
    expect(rows[0]).toHaveTextContent('同类第1张')
    expect(rows[1]).toHaveTextContent('同类第2张')
    expect(rows[2]).toHaveTextContent('同类第3张')
    expect(list.querySelector(`[data-alternative-id="${original.id}"]`)).toBeNull()
  })
})
