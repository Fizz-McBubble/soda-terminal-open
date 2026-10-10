import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode, type ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccountBackup } from '../accounts/backup'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { scopeLegacyEntity } from '../accounts/types'
import { database } from '../db/database'
import { sampleDiscs } from '../evaluation/fixtures'
import {
  createReadyScannerStaging,
  type createScannerRuntimeCommands,
} from './scannerAssistantPageTestSupport'

function jsonFile(value: unknown, name = 'local-data.json') {
  const text = JSON.stringify(value)
  const file = new File([text], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: vi.fn(async () => text), configurable: true })
  return file
}

async function backupFixture() {
  const account = await createAccount('文件兼容账户', database, {
    id: 'account-file-compatibility',
  })
  await setActiveAccount(account.id, database)
  await database.accountDriveDiscs.add(
    scopeLegacyEntity(
      account.id,
      { ...sampleDiscs.treasureCandidate, id: 'file-compat-disc' },
      '2026-10-09T00:00:00.000Z',
    ),
  )
  return createAccountBackup(account.id, database)
}

// 正式账户资产零写：仅扫描文件检查允许独立暂存，账户、资产、标签、鉴定、规划仍完整守恒。
async function accountSnapshot(includeStaging = true) {
  return Promise.all(
    database.tables
      .filter(
        (table) =>
          table.name.startsWith('account') &&
          (includeStaging ||
            !['accountScanImportBatches', 'accountScanImportItems'].includes(table.name)),
      )
      .map((table) => table.toArray()),
  )
}

async function expectUnimportedCheckDraft() {
  const batches = await database.accountScanImportBatches.toArray()
  const items = await database.accountScanImportItems.toArray()
  expect(batches).toHaveLength(1)
  expect(items).toHaveLength(1)
  expect(batches[0].accountId).toBe('account-file-compatibility')
  expect(batches[0].importHistory?.some((entry) => entry.action === 'imported')).not.toBe(true)
  expect(items[0].state).not.toBe('imported')
}

export function registerScannerDataFileCompatibilityTests({
  App,
  setRuntimeState,
  runtimeMock,
}: {
  App: ComponentType
  runtimeMock: { commands: ReturnType<typeof createScannerRuntimeCommands> }
  setRuntimeState: (state: string) => void
}) {
  describe('account backup and scan file entry compatibility', () => {
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        configurable: true,
      })
    })

    it('checks an account backup in the scanner and requires restore confirmation without writing, including Strict Mode', async () => {
      const file = jsonFile(await backupFixture(), 'backup-with-neutral-name.json')
      const before = await accountSnapshot()
      render(
        <StrictMode>
          <App />
        </StrictMode>,
      )
      fireEvent.change(
        await screen.findByLabelText('选择本机文件（JSON）', {}, { timeout: 5000 }),
        {
          target: { files: [file] },
        },
      )
      const review = await screen.findByRole('region', { name: '单账户备份检查' })
      const restore = await within(review).findByRole('button', { name: '确认恢复范围' })
      expect(window.location.pathname).toBe('/system/scanner')
      expect(within(review).getByText(new RegExp(file.name))).toBeVisible()
      expect(
        within(within(review).getByRole('region', { name: '备份恢复范围' })).getByText('1 张'),
      ).toBeVisible()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await accountSnapshot()).toEqual(before)
      fireEvent.click(restore)
      const dialog = await screen.findByRole('dialog', { name: '完整替换“文件兼容账户”的数据？' })
      expect(within(dialog).getByRole('button', { name: '取消' })).toHaveFocus()
      expect(await accountSnapshot()).toEqual(before)
      fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      fireEvent.click(within(review).getByRole('button', { name: '关闭检查' }))
      await waitFor(() =>
        expect(screen.queryByRole('region', { name: '单账户备份检查' })).not.toBeInTheDocument(),
      )
      const reads = vi.mocked(file.text).mock.calls.length
      fireEvent.click(
        within(screen.getByRole('navigation', { name: '主导航' })).getByRole('link', {
          name: '我的资产',
        }),
      )
      await waitFor(() => expect(window.location.pathname).toBe('/assets/agents'))
      await act(async () => {
        const returned = new Promise((resolve) =>
          window.addEventListener('popstate', resolve, { once: true }),
        )
        window.history.back()
        await returned
      })
      await screen.findByLabelText('选择本机文件（JSON）')
      expect(screen.queryByRole('region', { name: '单账户备份检查' })).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(vi.mocked(file.text).mock.calls.length).toBe(reads)
      expect(await accountSnapshot()).toEqual(before)
    })

    it.each(['unchecked', 'completed'])(
      'carries a scan result to confirmation in state %s with no formal account asset writes or reselecting',
      async (state) => {
        await backupFixture()
        setRuntimeState(state)
        const before = await accountSnapshot(false)
        window.history.replaceState({}, '', '/assets/account')
        const { container } = render(<App />)
        await screen.findByRole('button', { name: '选择并检查' })
        const file = jsonFile(
          createReadyScannerStaging(),
          'soda-terminal-account-misleading-name.json',
        )
        fireEvent.change(container.querySelector('input[type="file"]')!, {
          target: { files: [file] },
        })
        expect(await screen.findByRole('button', { name: '确认更新驱动盘' })).toBeEnabled()
        expect(window.location.pathname).toBe('/system/scanner')
        expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
        expect(screen.queryByRole('button', { name: '继续检查并导入' })).not.toBeInTheDocument()
        expect(await accountSnapshot(false)).toEqual(before)
        await expectUnimportedCheckDraft()
        expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
      },
    )

    it('still rejects an invalid backup through the actual restore validator', async () => {
      const backup = await backupFixture()
      const before = await accountSnapshot()
      render(<App />)
      fireEvent.change(await screen.findByLabelText('选择本机文件（JSON）'), {
        target: { files: [jsonFile({ ...backup, formatVersion: 99 })] },
      })
      await screen.findByRole('alert')
      expect(window.location.pathname).toBe('/system/scanner')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await accountSnapshot()).toEqual(before)
    })

    it('keeps a transferred scan file pending until an active scan releases the input', async () => {
      await backupFixture()
      const before = await accountSnapshot(false)
      setRuntimeState('scanning')
      window.history.replaceState({}, '', '/assets/account')
      const { container } = render(<App />)
      await screen.findByRole('button', { name: '选择并检查' })
      fireEvent.change(container.querySelector('input[type="file"]')!, {
        target: { files: [jsonFile(createReadyScannerStaging())] },
      })
      await screen.findByRole('button', { name: '停止本次扫描' })
      expect(screen.queryByRole('button', { name: '确认更新驱动盘' })).not.toBeInTheDocument()
      expect(await database.accountScanImportBatches.count()).toBe(0)
      expect(await accountSnapshot(false)).toEqual(before)
      setRuntimeState('ready')
      // The runtime stub has no subscription; refresh the route context without remounting.
      await act(async () => window.dispatchEvent(new PopStateEvent('popstate')))
      await waitFor(() =>
        expect(document.querySelector('.scanner-golden')).toHaveAttribute(
          'data-scanner-visual-state',
          'ready',
        ),
      )
      expect(await screen.findByRole('button', { name: '确认更新驱动盘' })).toBeEnabled()
      await expectUnimportedCheckDraft()
      expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
      expect(await accountSnapshot(false)).toEqual(before)
    })

    it('does not navigate for an older scanner file read that finishes after a replacement selection', async () => {
      const backup = await backupFixture()
      const before = await accountSnapshot(false)
      let finishRead!: (value: string) => void
      const oldFile = jsonFile(backup)
      Object.defineProperty(oldFile, 'text', {
        value: () =>
          new Promise<string>((resolve) => {
            finishRead = resolve
          }),
      })
      render(<App />)
      const picker = await screen.findByLabelText('选择本机文件（JSON）')
      fireEvent.change(picker, { target: { files: [oldFile] } })
      fireEvent.change(picker, { target: { files: [jsonFile(createReadyScannerStaging())] } })
      await screen.findByRole('button', { name: '确认更新驱动盘' })
      const stagedBeforeLateRead = await Promise.all([
        database.accountScanImportBatches.toArray(),
        database.accountScanImportItems.toArray(),
      ])
      await act(async () => finishRead(JSON.stringify(backup)))
      expect(
        await Promise.all([
          database.accountScanImportBatches.toArray(),
          database.accountScanImportItems.toArray(),
        ]),
      ).toEqual(stagedBeforeLateRead)
      expect(window.location.pathname).toBe('/system/scanner')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: '单账户备份检查' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '确认更新驱动盘' })).toBeEnabled()
      expect(await accountSnapshot(false)).toEqual(before)
      await expectUnimportedCheckDraft()
      expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
    })

    it('does not navigate for an older account file read that finishes after a replacement backup', async () => {
      const backup = await backupFixture()
      let finishRead!: (value: string) => void
      const oldFile = jsonFile(createReadyScannerStaging())
      Object.defineProperty(oldFile, 'text', {
        value: () =>
          new Promise<string>((resolve) => {
            finishRead = resolve
          }),
      })
      window.history.replaceState({}, '', '/assets/account')
      const { container } = render(<App />)
      await screen.findByRole('button', { name: '选择并检查' })
      const picker = container.querySelector('input[type="file"]')!
      fireEvent.change(picker, { target: { files: [oldFile] } })
      fireEvent.change(picker, { target: { files: [jsonFile(backup, 'latest-backup.json')] } })
      const dialog = await screen.findByRole('dialog', { name: '用所选备份恢复账户？' })
      await act(async () => finishRead(JSON.stringify(createReadyScannerStaging())))
      expect(window.location.pathname).toBe('/assets/account')
      expect(within(dialog).getByText('latest-backup.json')).toBeVisible()
    })
  })
}
