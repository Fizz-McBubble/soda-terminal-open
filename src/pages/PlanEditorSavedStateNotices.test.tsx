import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PlanEditorSavedStateNotices } from './PlanEditorSavedStateNotices'
import { sealSavedLuminizeReplay32 } from '../application/savedLuminizeReplay32'
import { reviewedLumifluxMechanicsHash32 as sourceHash } from '../calculation/reviewedLumifluxMechanics32'

afterEach(cleanup)

const props = {
  objectiveNote: undefined,
  needsTeamRecovery: false,
  staleNotice: undefined,
  reanalyze: () => {},
}
function result(status: 'declared_arithmetic' | 'stale') {
  const success = status === 'declared_arithmetic'
  return sealSavedLuminizeReplay32({
    contract: 'soda-saved-luminize-replay32/v1',
    status,
    // The schema checks this against the current source for successful results.
    sourceIdentityHash: sourceHash,
    snapshotFingerprint: 'fixture-snapshot',
    inputFingerprint: success ? 'fixture-input' : null,
    totalDamage: success ? 12345.67 : null,
    instances: success
      ? [{ id: 'fixture-flare', ownerAgentId: 'agent-aria', attribute: 'ether', damage: 12345.67 }]
      : [],
    blockers: success ? [] : ['luminize_saved_source_stale'],
    boundary: '单次非暴击声明，不代表完整循环。',
    formalCycleReady: false,
    modelQualification32: null,
  })
}

it('keeps the saved mechanism result in the existing plan note without adding an entry or row', () => {
  const view = render(<PlanEditorSavedStateNotices {...props} />)
  expect(screen.queryByRole('status')).toBeNull()
  view.rerender(
    <PlanEditorSavedStateNotices
      {...props}
      objectiveNote="原配装条件"
      luminizeSettlement32={result('declared_arithmetic')}
    />,
  )
  expect(screen.getByRole('status').textContent).toContain(
    '保存时的配装说明：原配装条件；单次辉映 12,345.67',
  )
  expect(view.container.querySelectorAll('p')).toHaveLength(1)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('replaces the number with an actionable stale state instead of displaying zero or old damage', () => {
  const view = render(
    <PlanEditorSavedStateNotices {...props} luminizeSettlement32={result('declared_arithmetic')} />,
  )
  view.rerender(<PlanEditorSavedStateNotices {...props} luminizeSettlement32={result('stale')} />)
  expect(screen.getByRole('status').textContent).toContain('历史快照仍保留')
  expect(screen.getByRole('status').textContent).not.toContain('12,345')
  expect(screen.getByRole('status').textContent).not.toContain('0（单次')
})
