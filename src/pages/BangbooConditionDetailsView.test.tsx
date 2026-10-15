import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BangbooConditionDetailsView } from './BangbooConditionDetailsView'
import { describeBangbooConditions } from '../decision/bangbooConditionPresentation'

it('keeps the entire purpose inside the existing disclosure so selecting a longer purpose cannot grow the card', () => {
  const purpose = '1星可激活额外能力；提高邦布自身伤害。部分效果按概率触发。'
  render(
    <BangbooConditionDetailsView
      condition={{
        ...describeBangbooConditions({
          memberIds: ['agent-billy', 'agent-anby', 'agent-nicole'],
          bangbooId: 'bangboo-avocaboo',
          stars: 1,
        }),
        purposeSummary: purpose,
      }}
    />,
  )
  const description = screen.getByText(
    (_, element) => element?.tagName === 'P' && element.textContent === purpose,
  )
  expect(description.closest('[popover="auto"]')).not.toBeNull()
  expect(screen.getByRole('button', { name: '技能与触发条件' })).toBeInTheDocument()
  expect(
    description.closest('.team-execution__bangboo-conditions')?.querySelector(':scope > p'),
  ).toBeNull()
})
