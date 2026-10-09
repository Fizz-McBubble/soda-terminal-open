import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode, type ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccountBackup } from '../accounts/backup'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { scopeLegacyEntity } from '../accounts/types'
import { database } from '../db/database'
import { sampleDiscs } from '../evaluation/fixtures'
import { createReadyScannerStaging } from './scannerAssistantPageTestSupport'

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

async function accountSnapshot() {
  return Promise.all(
    database.tables
      .filter((table) => table.name.startsWith('account'))
      .map((table) => table.toArray()),
  )
}

export function registerScannerDataFileCompatibilityTests({
  App,
  setRuntimeState,
}: {
  App: ComponentType
  setRuntimeState: (state: string) => void
}) {
  describe('account backup and scan file entry compatibility', () => {
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        configurable: true,
      })
    })

    it('carries an account backup from the scanner into restore confirmation without writing, including Strict Mode', async () => {
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
      const dialog = await screen.findByRole(
        'dialog',
        { name: '用所选备份恢复账户？' },
        { timeout: 5000 },
      )
      expect(window.location.pathname).toBe('/assets/account')
      expect(within(dialog).getByText(file.name)).toBeVisible()
      expect(within(dialog).getByText(/1 张驱动盘/)).toBeVisible()
      expect(await accountSnapshot()).toEqual(before)
      fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      const reads = vi.mocked(file.text).mock.calls.length
      fireEvent.click(
        within(screen.getByRole('navigation', { name: '我的资产分类' })).getByRole('button', {
          name: /^代理人/,
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
      await screen.findByRole('button', { name: '选择并检查' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(vi.mocked(file.text).mock.calls.length).toBe(reads)
      expect(await accountSnapshot()).toEqual(before)
    })

    it.each(['unchecked', 'completed'])(
      'carries a scan result to scanner preflight in state %s without writing or reselecting',
      async (state) => {
        await backupFixture()
        setRuntimeState(state)
        const before = await accountSnapshot()
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
        expect(await screen.findByText('扫描结果文件已就绪')).toBeVisible()
        expect(window.location.pathname).toBe('/system/scanner')
        expect(screen.getByText(`继续检查“${file.name}”，无需重新选择文件。`)).toBeVisible()
        expect(screen.getByRole('button', { name: '继续检查并导入' })).toBeEnabled()
        expect(await accountSnapshot()).toEqual(before)
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
      expect(window.location.pathname).toBe('/assets/account')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await accountSnapshot()).toEqual(before)
    })

    it('keeps a transferred scan file pending until an active scan releases the input', async () => {
      await backupFixture()
      const before = await accountSnapshot()
      setRuntimeState('scanning')
      window.history.replaceState({}, '', '/assets/account')
      const { container } = render(<App />)
      await screen.findByRole('button', { name: '选择并检查' })
      fireEvent.change(container.querySelector('input[type="file"]')!, {
        target: { files: [jsonFile(createReadyScannerStaging())] },
      })
      await screen.findByRole('button', { name: '停止本次扫描' })
      expect(screen.queryByText('扫描结果文件已就绪')).not.toBeInTheDocument()
      expect(await accountSnapshot()).toEqual(before)
      setRuntimeState('ready')
      // The runtime stub has no subscription; refresh the route context without remounting.
      await act(async () => window.dispatchEvent(new PopStateEvent('popstate')))
      await waitFor(() =>
        expect(document.querySelector('.scanner-golden')).toHaveAttribute(
          'data-scanner-visual-state',
          'ready',
        ),
      )
      expect(await screen.findByText('扫描结果文件已就绪')).toBeVisible()
      expect(await accountSnapshot()).toEqual(before)
    })

    it('does not navigate for an older scanner file read that finishes after a replacement selection', async () => {
      const backup = await backupFixture()
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
      await screen.findByText('扫描结果文件已就绪')
      await act(async () => finishRead(JSON.stringify(backup)))
      expect(window.location.pathname).toBe('/system/scanner')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
