import { describe, expect, it } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { driveDiscData } from '../data/gameData'
import { createEmptyRoster } from '../assault/catalog'
import { input as worldInput } from '../decision/warehouseActionProjection.testFixture'
import { projectWarehouseActions } from '../application/warehouseActionProjection'
import { WarehouseRetentionEvidence } from '../pages/WarehouseRetentionEvidence'
import { analyzeAccountWarehouse } from './discWarehouseAnalysis'
import type { WarehouseAnalysisInput } from './discWarehouseEvidence'
import { warehouseTestDisc } from './discWarehouseAnalysis.testFixtures'

const protectionLabels = ['已收藏', '当前正在装备', '已保存方案正在使用', '选定队伍正在使用']

function input(mask = 0): WarehouseAnalysisInput {
  const base = worldInput()
  const accountId = base.warehouse.accountId
  if (!accountId) throw new Error('synthetic account id required')
  const flatPenRoll = driveDiscData!.rules.subStatStepsByRarity.S.find(
    (rule) => rule.stat === 'pen',
  )!.baseValue
  const disc = warehouseTestDisc('protected-low-quality', {
    setId: 'set-woodpecker-electro',
    slot: 2,
    mainStat: 'atk_flat',
    favorite: Boolean(mask & 1),
    subStats: [
      { stat: 'hp_flat', value: 112, upgrades: 0 },
      { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
      { stat: 'def_flat', value: 15, upgrades: 0 },
      { stat: 'pen', value: flatPenRoll * 6, upgrades: 5 },
    ],
  })
  const roster = createEmptyRoster('2026-09-30T00:00:00.000Z')
  roster.agents[0] = {
    ...roster.agents[0]!,
    owned: true,
    equippedDiscIds: mask & 2 ? [disc.id] : [],
  }
  return {
    accountId,
    discs: [disc],
    roster,
    drafts: mask & 4 ? [{ ...base.drafts[0]!, warehouseRefs: [disc.id] }] : [],
    protectedSimultaneousDemands: mask & 8 ? [{ id: 'selected-team', discIds: [disc.id] }] : [],
    protectedDemandCoverageComplete: true,
  }
}

function intrinsic(
  evidence: NonNullable<
    ReturnType<typeof analyzeAccountWarehouse>['decisions'][number]['absoluteRetention']
  >,
) {
  const quality = structuredClone(evidence)
  delete quality.nextAction
  return quality
}

describe('current protection action and intrinsic quality', () => {
  function project(source: WarehouseAnalysisInput) {
    const { warehouse } = worldInput()
    return projectWarehouseActions({
      status: 'current',
      run: {
        runId: 'warehouse-protection',
        input: {
          warehouse: { ...warehouse, discs: source.discs, roster: source.roster },
          drafts: source.drafts,
        },
        snapshot: {
          warehouse: analyzeAccountWarehouse(source),
          sideEffect: 'read_only',
          account: { accountId: source.accountId },
          fingerprint: { inputHash: 'warehouse-protection' },
          claims: { warehouse: { status: 'candidate', summary: '' } },
        },
      },
    }).actions[0]!
  }

  it('keeps the unprotected PEN-led low quality path in review instead of cleanup', () => {
    const action = project(input())
    expect(action.action).toBe('enhance')
    expect(action.absoluteRetention?.nextAction?.kind).toBe('review_quality')
    expect(action.absoluteRetention?.disposition).toBe('review')
    expect(action.recommendationState).toBe('needs_review')
    expect(action.absoluteRetention?.blockedBy).toContainEqual(
      expect.objectContaining({
        field: 'cleanupCalibration.secondaryPenPrimary',
        kind: 'policy',
        predicateId: 'independent-pen-primary-calibration-20261025',
      }),
    )
  })

  it.each(Array.from({ length: 15 }, (_, index) => index + 1))(
    'gives a consistent keep action and every current protection source for mask %s',
    async (mask) => {
      const source = input(mask)
      const before = structuredClone(source)
      const unprotected = analyzeAccountWarehouse(input()).decisions[0]!.absoluteRetention!
      const action = project(source)
      expect(source).toEqual(before)
      expect(action.action).toBe('keep')
      expect(action.absoluteRetention?.nextAction).toMatchObject({
        kind: 'keep',
        targetLevel: null,
      })
      expect(intrinsic(action.absoluteRetention!)).toEqual(intrinsic(unprotected))
      for (const [index, label] of protectionLabels.entries()) {
        if (mask & (1 << index)) {
          expect(action.absoluteRetention?.nextAction?.detail).toContain(label)
          expect(action.reasons.join('')).toContain(label)
        } else {
          expect(action.absoluteRetention?.nextAction?.detail).not.toContain(label)
        }
      }
      render(
        <WarehouseRetentionEvidence
          ownedAgentIds={new Set(['agent-anby'])}
          evidence={action.absoluteRetention!}
          discLevel={15}
        />,
      )
      const status = screen.getByRole('status')
      expect(status.textContent).toContain('下一步：保留')
      expect(status.textContent).not.toContain('人工清理')
      // The current contract places the same score behind a recommended agent avatar.
      await userEvent.click(screen.getAllByRole('button', { name: /查看.*的词条匹配/ })[0]!)
      const scoreFacts = within(screen.getByRole('dialog')).getByRole('group', { name: '词条匹配' })
      expect(scoreFacts).toBeVisible()
      expect(
        within(screen.getByRole('dialog')).getByRole('heading', { name: '词条匹配' }),
      ).toBeVisible()
      expect(scoreFacts).not.toHaveTextContent('保留参考')
      expect(scoreFacts.querySelector('details')).toBeNull()
      expect(screen.queryByText('查看参考评分')).not.toBeInTheDocument()
      expect(
        status.compareDocumentPosition(scoreFacts) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(screen.getByText('处理前请先确认是否仍在使用。')).toBeTruthy()
      expect(
        screen.queryAllByText(/收藏|保护/).filter((element) => !element.closest('[role="dialog"]')),
      ).toHaveLength(0)
      cleanup()
    },
  )

  it('reviews an unowned Claret flat-defense use with the promoted-base quality', () => {
    const source = input()
    source.discs[0] = warehouseTestDisc('unowned-claret-defense-use', {
      setId: 'set-woodpecker-electro',
      slot: 1,
      mainStat: 'hp_flat',
      subStats: [
        { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
        { stat: 'atk_percent', value: 3, upgrades: 0 },
        { stat: 'hp_percent', value: 3, upgrades: 0 },
        { stat: 'def_flat', value: 90, upgrades: 5 },
      ],
    })
    const before = structuredClone(source)
    const evidence = analyzeAccountWarehouse(source).decisions[0]!.absoluteRetention!
    // Pinned Claret DEF at level60 includes the cumulative fifth promotion.
    // Keep this arithmetic independent of the production weight resolver.
    const baseDefense = 35 + 4.8155 * 59 + 122
    const flatDefenseRollWeight = Math.round(((0.75 * 15) / (baseDefense * 0.048)) * 1e6) / 1e6
    // This is an explicit future use, even though Claret is not owned.
    const use = evidence.leadingUses.find((row) => row.agentId === 'agent-claret')
    expect(use).toBeDefined()
    expect(use!.useState).toBe('valid')
    expect(use!.currentScore).toBeCloseTo(
      ((1 + 6 * flatDefenseRollWeight) / (5 + 1 + 1 + 0.75 + flatDefenseRollWeight)) * 100,
      5,
    )
    expect(evidence.unownedUseAgentIds).toContain('agent-claret')
    // The independent score is between the unchanged cleanup and keep lines.
    // A sourced future use survives, but it must not overstate this disc's quality.
    expect(evidence.disposition).toBe('observe')
    expect(evidence.reasonKind).toBe('quality_borderline')
    expect(evidence.nextAction).toMatchObject({ kind: 'review_quality', targetLevel: null })
    expect(evidence.nextAction?.stopWhen).toContain('已满级')
    const action = project(source)
    expect(action.action).toBe('enhance')
    expect(action.absoluteRetention?.nextAction?.kind).toBe('review_quality')
    expect(source).toEqual(before)
  })

  it('does not invent protection for unrelated discs from missing equipment or saved references', () => {
    const source = input()
    source.roster.agents[0]!.equippedDiscIds = ['absent-equipped']
    source.drafts = [{ ...worldInput().drafts[0]!, warehouseRefs: ['absent-saved'] }]
    source.activePlanIds = { 'agent-nicole': source.drafts[0]!.id }
    const result = analyzeAccountWarehouse(source)
    expect(result.referenceIssues?.equipmentNeedsReview).toBe(true)
    expect(result.decisions[0]!.cleanupSafety).toMatchObject({
      equipped: false,
      savedPlanReferenced: false,
      portfolioReferenced: false,
    })
    expect(project(source).absoluteRetention?.nextAction?.kind).toBe('review_quality')
    expect(project(source).action).toBe('enhance')
  })

  it('requires reference review for unresolved simultaneous demand without claiming direct protection', () => {
    const source = input()
    source.protectedSimultaneousDemands = [
      { id: 'invalid-selection', discIds: ['absent-selected'] },
    ]
    const result = analyzeAccountWarehouse(source)
    expect(result.referenceIssues?.simultaneousNeedsReview).toBe(true)
    expect(result.decisions[0]!.cleanupSafety.portfolioReferenced).toBe(false)
    expect(project(source).absoluteRetention?.nextAction?.kind).toBe('check_condition')
    expect(project(source).absoluteRetention?.nextAction?.detail).not.toContain('正在使用')
  })

  it('preserves a surviving active saved-plan protection when another reference is missing', () => {
    const source = input(4)
    source.drafts[0]!.kind = 'team'
    source.drafts[0]!.warehouseRefs.push('absent-saved')
    source.activePlanIds = { 'agent-nicole': source.drafts[0]!.id }
    const action = project(source)
    expect(action.action).toBe('keep')
    expect(action.absoluteRetention?.nextAction?.kind).toBe('keep')
    expect(action.absoluteRetention?.nextAction?.detail).toContain('已保存方案正在使用')
    expect(action.statuses).toContain('active_plan_reference')
  })

  it('preserves concrete equipment references while reviewing an inconsistent ownership marker', () => {
    const source = input(2)
    source.roster.agents[0]!.owned = false
    const before = structuredClone(source)
    const result = analyzeAccountWarehouse(source)
    expect(project(source).absoluteRetention?.nextAction?.kind).toBe('keep')
    expect(result.decisions[0]!.cleanupSafety.equipped).toBe(true)
    expect(result.referenceIssues?.equipmentNeedsReview).toBe(true)
    expect(source).toEqual(before)
  })
})
