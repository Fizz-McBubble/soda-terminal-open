import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  bridge,
  health,
  job,
  persistence,
  prepareStart,
  startAndReceive,
  targetAccountId,
} from './assetQuickReadControllerTestFixture'
import { AssetQuickReadController } from './AssetQuickReadController'
import { AssetQuickReadRequestError } from '../assetQuickRead/diagnostics'
import { readAssetDiagnostic } from '../assetQuickRead/feedback'
import { AssetQuickReadImportError } from '../assetQuickRead/importErrors'
import { AssetQuickReadUnavailableError } from '../assetQuickRead/launcher'

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
  expect(document.body).not.toHaveTextContent('private path')
})

it.each([
  ['origin_not_allowed', '资产快读尚未允许当前站点连接。', '核对工具版本与当前页面地址'],
  ['bridge_incompatible', '资产快读版本不兼容。', '更新资产快读后重新连接'],
] as const)(
  'keeps safe %s detail in the real workbench status and diagnostic, then clears it on retry',
  async (code, problem, nextAction) => {
    const client = bridge()
    client.connect.mockRejectedValueOnce(
      new AssetQuickReadRequestError(code, "soda-source-ref:7b49bd2ecb2f513254b218dbc48fc648"),
    )
    client.connect.mockResolvedValueOnce({ ...health, version: '1.0.7' })
    render(
      <AssetQuickReadController
        client={client}
        targetAccountId={targetAccountId}
        activeAccountId={targetAccountId}
        targetAccountName="合成账户"
        workbench={({ preparation, task }) => (
          <>
            {preparation}
            {task}
          </>
        )}
      />,
    )
    fireEvent.change(screen.getByLabelText('游戏安装目录'), {
      target: { value: "soda-source-ref:24d5780e541a1a1ad1393e8962be6e18" },
    })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
    expect(screen.getByRole('alert')).toHaveTextContent(problem)
    expect(screen.getByRole('alert')).toHaveTextContent(nextAction)
    expect(screen.getByRole('status')).toHaveTextContent(problem)
    fireEvent.click(screen.getByText('查看诊断'))
    expect(document.body).toHaveTextContent(nextAction)
    expect(document.body).not.toHaveTextContent('请检查安装目录后重试')
    expect(document.body).not.toHaveTextContent('Private')
    expect(document.body).not.toHaveTextContent('synthetic-secret')
    expect(JSON.stringify(readAssetDiagnostic())).not.toContain('Private')
    expect(readAssetDiagnostic()?.code).toBe(code)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(problem)
    expect(screen.getByRole('button', { name: '一键读取' })).toBeEnabled()
  },
)

it('does not infer a directory, permission denial or stopped service from an unknown connection exception', async () => {
  const client = bridge()
  client.connect.mockRejectedValue(new Error("soda-source-ref:7b49bd2ecb2f513254b218dbc48fc648"))
  render(
    <AssetQuickReadController
      client={client}
      workbench={({ preparation, task }) => (
        <>
          {preparation}
          {task}
        </>
      )}
    />,
  )
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  expect(screen.getByRole('alert')).toHaveTextContent('请确认工具已运行')
  expect(screen.getByRole('alert')).toHaveTextContent('允许本站访问本机设备')
  expect(document.body).not.toHaveTextContent('Private')
  expect(document.body).not.toHaveTextContent('synthetic-secret')
  expect(document.body).not.toHaveTextContent('请检查安装目录后重试')
  expect(document.body).not.toHaveTextContent('资产快读尚未启动')
  expect(readAssetDiagnostic()).toMatchObject({ stage: 'connection', code: 'bridge_unavailable' })
})

it('preserves the same safe connection code on a fresh failed retry instead of treating it as an old error', async () => {
  const client = bridge()
  client.connect.mockRejectedValue(
    new AssetQuickReadRequestError('origin_not_allowed', 'private response'),
  )
  render(
    <AssetQuickReadController
      client={client}
      workbench={({ preparation, task }) => (
        <>
          {preparation}
          {task}
        </>
      )}
    />,
  )
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  const previousId = readAssetDiagnostic()!.reportId
  expect(screen.getByRole('alert')).toHaveTextContent('资产快读尚未允许当前站点连接。')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  expect(client.connect).toHaveBeenCalledTimes(2)
  expect(readAssetDiagnostic()).toMatchObject({ code: 'origin_not_allowed' })
  expect(readAssetDiagnostic()!.reportId).not.toBe(previousId)
  expect(screen.getByRole('alert')).toHaveTextContent('资产快读尚未允许当前站点连接。')
  expect(screen.getByRole('alert')).toHaveTextContent('核对工具版本与当前页面地址')
  expect(document.body).not.toHaveTextContent('private response')
  expect(document.body).not.toHaveTextContent('请确认工具已运行')
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
  expect(readAssetDiagnostic()).toMatchObject({ evidence: {}, durationMs: null })
})

it('keeps the recovery quota reason without the captured job facts or account writes', async () => {
  persistence.prepare.mockRejectedValue(
    new AssetQuickReadImportError('import_recovery_limit_reached', '已达 10 份'),
  )
  mount()
  await startAndReceive()
  expect(readAssetDiagnostic()).toMatchObject({
    stage: 'import',
    code: 'import_recovery_limit_reached',
    counts: { processed: null, total: null },
    evidence: {},
    durationMs: null,
  })
  expect(readAssetDiagnostic()!.counts).not.toHaveProperty('agents')
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
})

it('records unavailable transport during startup as a connection failure code', async () => {
  const client = bridge()
  client.start.mockRejectedValue(new AssetQuickReadUnavailableError('未能连接'))
  mount(client)
  await prepareStart()
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /^(开始本次资产快读|开始读取)$/ })),
  )
  expect(readAssetDiagnostic()).toMatchObject({
    stage: 'startup',
    code: 'bridge_unavailable',
    evidence: {},
    durationMs: null,
  })
})
