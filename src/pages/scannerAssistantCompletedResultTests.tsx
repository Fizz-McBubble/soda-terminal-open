import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { expect, it } from 'vitest'
import { createAccount, getActiveAccount, setActiveAccount } from '../accounts/repository'
import { database } from '../db/database'
import {
  createScannerTargetAccountBinding,
  readScannerTargetAccountBinding,
  saveScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import type { createScannerRuntimeCommands } from './scannerAssistantPageTestSupport'
export function registerScannerCompletedResultTests({
  App,
  runtimeMock,
  setRuntimeState,
}: {
  App: ComponentType
  runtimeMock: {
    commands: ReturnType<typeof createScannerRuntimeCommands>
    snapshot: Record<string, unknown>
  }
  setRuntimeState: (state: string) => void
}) {
  it('keeps the completed result usable after the active account changes', async () => {
    const user = userEvent.setup()
    const alpha = await createAccount('Alpha', database, { id: 'account-alpha' })
    const beta = await createAccount('Beta', database, { id: 'account-beta' })
    await setActiveAccount(alpha.id, database)
    setRuntimeState('ready')
    const rendered = render(<App />)
    await screen.findByRole('combobox', { name: '目标账户' })
    const start = screen.getByRole('button', { name: '开始扫描' })
    await waitFor(() => expect(start).toBeEnabled())
    await user.click(start)
    await waitFor(() => expect(runtimeMock.commands.startScan).toHaveBeenCalledTimes(1))

    await setActiveAccount(beta.id, database)
    setRuntimeState('completed')
    rendered.rerender(<App />)
    const handoff = await screen.findByRole('button', { name: '确认账户并继续' })
    expect(handoff).toBeEnabled()
    expect(screen.getByText(/本次结果.*平均 230 张\/分钟/)).toBeInTheDocument()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('扫描目标与当前账户不一致')
    expect(alert).toHaveTextContent('本次扫描锁定“Alpha”，当前账户为“Beta”')
    const comparison = screen.getByRole('group', { name: '账户归属比较' })
    expect(comparison).toHaveTextContent('扫描时选择的账户Alpha')
    expect(comparison).toHaveTextContent('当前接收账户Beta')
    expect(comparison).not.toHaveTextContent(/account-alpha|account-beta|binding-/)
    await user.click(handoff)
    await waitFor(() => expect(runtimeMock.commands.requestResultFile).toHaveBeenCalledTimes(1))
    expect((await getActiveAccount(database))?.id).toBe('account-beta')
  })

  it('lets a zero-account user discard a result bound to a deleted account and restart', async () => {
    const user = userEvent.setup()
    const deleted = await createAccount('已删除账户', database, { id: 'account-deleted' })
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account: deleted, baselineDiscCount: 492 }),
    )
    await database.accounts.delete(deleted.id)
    setRuntimeState('completed')
    const rendered = render(<App />)

    const targetIssue = await screen.findByText('扫描目标账户已不可用')
    expect(targetIssue.closest('[role="alert"]')).toHaveTextContent('扫描目标账户已不可用')
    expect(screen.getByRole('button', { name: '确认账户并继续' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '放弃此结果并重新扫描' }))

    await waitFor(() => expect(runtimeMock.commands.retryConnection).toHaveBeenCalledTimes(1))
    expect(readScannerTargetAccountBinding()).toMatchObject({ valid: false })
    expect(await screen.findByRole('textbox', { name: '新账户名称' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '创建并用于本次操作' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: '扫描助手已连接' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
    rendered.unmount()
    render(<App />)
    expect(await screen.findByRole('textbox', { name: '新账户名称' })).toBeInTheDocument()
    expect(runtimeMock.commands.requestResultFile).not.toHaveBeenCalled()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('shows the same player name on both sides when an existing binding only fails a non-identity gate', async () => {
    const account = await createAccount('同名接收账户', database, { id: 'account-same-name' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({
        account,
        baselineDiscCount: 1,
        bindingId: 'binding-same-name',
      }),
    )
    setRuntimeState('completed')
    render(<App />)

    const comparison = await screen.findByRole('group', { name: '账户归属比较' })
    expect(comparison).toHaveTextContent('扫描时选择的账户同名接收账户')
    expect(comparison).toHaveTextContent('当前接收账户同名接收账户')
    expect(screen.getByRole('button', { name: '确认账户并继续' })).toBeEnabled()
    expect((runtimeMock.snapshot as { state?: string }).state).toBe('completed')
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
  })

  it('keeps a completed result without binding in read-only review instead of inventing an account conflict', async () => {
    const account = await createAccount('波子汽水', database, { id: 'account-completed' })
    await setActiveAccount(account.id, database)
    setRuntimeState('completed')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '结果已生成，先检查再导入' }),
    ).toBeInTheDocument()
    expect(document.querySelector('.scanner-golden')).toHaveAttribute(
      'data-scanner-visual-state',
      'completed',
    )
    expect(screen.queryByRole('group', { name: '账户归属比较' })).not.toBeInTheDocument()
    const accountPicker = screen.getByRole('combobox', { name: '目标账户' })
    expect(accountPicker).toHaveTextContent('波子汽水')
    expect(screen.getByRole('button', { name: '确认账户并继续' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '放弃此结果并重新扫描' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /正式导入/ })).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
    const summary = document.querySelector('.scanner-web__summary')!
    expect(
      accountPicker.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(summary.querySelectorAll('article')).toHaveLength(2)
    expect(summary).not.toHaveTextContent('代理人')
    expect(summary).not.toHaveTextContent('音擎')
    expect(summary).toHaveTextContent('本次结果 · 平均 230 张/分钟384')
    expect(summary).toHaveTextContent('更新账户')
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
    expect(runtimeMock.commands.requestResultFile).not.toHaveBeenCalled()
  })

  it('presents completed scan results in player language on the same page', async () => {
    const account = await createAccount('结果核对账户', database, { id: 'account-result-dialog' })
    await setActiveAccount(account.id, database)
    setRuntimeState('completed')
    render(<App />)

    const result = await screen.findByRole('region', { name: '已完成扫描结果' })
    expect(result).toHaveTextContent('本次结果 · 平均 230 张/分钟384')
    expect(result).not.toHaveTextContent(
      /reliable|needsReview|unreadable|resultFileHandle|resultStatus|uniqueRecords|totalSeconds/,
    )
    expect(document.querySelector('.scanner-task dialog')).toBeNull()
    expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
    expect(screen.getByRole('button', { name: '确认账户并继续' })).toBeEnabled()
  })
}
