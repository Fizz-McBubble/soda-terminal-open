import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TeamGroup } from './TeamLoadoutRecommendationGroup'
import {
  buildTeamLoadoutOverviewModel,
  decisionWithResultLayers,
} from './teamLoadoutOverviewModel.testFixture'

it('selects the exact alternative from its own public recommendation card', () => {
  const model = buildTeamLoadoutOverviewModel({
    decision: decisionWithResultLayers(),
    savedPlans: [],
  })
  const source = model.groups.find((group) => group.kind === 'recommended')!
  const family = source.items[0]!
  const base = family.variants[0]!
  const alternatives = ['agent-qingyi', 'agent-nicole', 'agent-billy', 'agent-koleda'].map(
    (id) => ({ ...base, id: `entry:${id}`, agentIds: [...base.agentIds.slice(0, 2), id] }),
  )
  const group = { ...source, items: [{ ...family, variants: [base, ...alternatives] }] }
  const onVariantSelect = vi.fn()
  render(
    <TeamGroup
      group={group}
      selectedId=""
      activeVariants={{}}
      onSelect={vi.fn()}
      onVariantSelect={onVariantSelect}
    />,
  )
  const row = screen.getByRole('listitem')
  expect(row.querySelectorAll('[data-variant-id]')).toHaveLength(3)
  expect(row.querySelector('button button')).toBeNull()
  fireEvent.click(within(row).getByRole('button', { name: '展开其余 2 种搭配' }))
  fireEvent.click(within(row).getByRole('button', { name: /比利/ }))
  expect(onVariantSelect).toHaveBeenCalledWith(family.id, 'entry:agent-billy')
})
