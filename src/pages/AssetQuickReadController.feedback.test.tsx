import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  bridge,
  job,
  persistence,
  prepareStart,
  startAndReceive,
  targetAccountId,
} from './assetQuickReadControllerTestFixture'
import { AssetQuickReadController } from './AssetQuickReadController'
import { AssetQuickReadRequestError } from '../assetQuickRead/diagnostics'
import { readAssetDiagnostic } from '../assetQuickRead/feedback'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))
beforeEach(() => localStorage.clear())
function mount(client = bridge()) {
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
    />,
  )
  return client
}
it('captures a connection failure locally in the original preparation area', async () => {
  const client = bridge()
  client.connect.mockRejectedValue(
    new AssetQuickReadRequestError('origin_not_allowed', 'private path'),
  )
  mount(client)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  expect(readAssetDiagnostic()).toMatchObject({ stage: 'permission', code: 'origin_not_allowed' })
  expect(screen.getByText('资产快读诊断')).toBeInTheDocument()
  expect(JSON.stringify(readAssetDiagnostic())).not.toContain('private')
})
it('returns from a rejected result to preparation without appending the old diagnostic', async () => {
  persistence.prepare.mockRejectedValueOnce(new Error('snapshot_already_imported'))
  mount()
  await startAndReceive()
  expect(screen.getByText('资产快读诊断')).toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '放弃' })))
  expect(screen.queryByText('资产快读诊断')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '准备资产快读' })).toBeEnabled()
  expect(readAssetDiagnostic()).toMatchObject({ stage: 'import' })
})
it('preserves concrete UAC failure on the starting response', async () => {
  const client = bridge()
  client.start.mockResolvedValue({ ...job, state: 'error', phase: 'uac', code: 'uac_declined' })
  mount(client)
  await prepareStart()
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /^(开始本次资产快读|开始读取)$/ })),
  )
  expect(readAssetDiagnostic()).toMatchObject({ stage: 'permission', code: 'uac_declined' })
})
it('records terminal wait timeout without private native job identity', async () => {
  const client = bridge()
  client.status.mockResolvedValue({
    ...job,
    state: 'timed_out',
    phase: 'capture',
    code: null,
    remainingSeconds: 0,
  })
  mount(client)
  await startAndReceive()
  expect(readAssetDiagnostic()).toMatchObject({
    stage: 'waiting',
    code: 'wait_timeout',
    evidence: { remainingSeconds: 0 },
  })
  expect(JSON.stringify(readAssetDiagnostic())).not.toContain(targetAccountId)
})
it('records result reading failure before account mutation', async () => {
  const client = bridge()
  client.result.mockRejectedValue(
    new AssetQuickReadRequestError('candidate_schema_invalid', 'raw error'),
  )
  mount(client)
  await startAndReceive()
  expect(readAssetDiagnostic()).toMatchObject({ stage: 'result', code: 'candidate_schema_invalid' })
  expect(persistence.confirm).not.toHaveBeenCalled()
})
it('records import failure only after the user import action', async () => {
  mount()
  await startAndReceive()
  expect(readAssetDiagnostic()).toBeNull()
  persistence.confirm.mockRejectedValue(new Error('private account error'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '导入' })))
  expect(readAssetDiagnostic()).toMatchObject({ stage: 'import', code: 'import_failed' })
})
