import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { database } from '../db/database'
import {
  createScannerTargetAccountBinding,
  saveScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'
import {
  cleanupScannerPageTestDatabase,
  createScannerRuntimeCommands,
  resetScannerPageTestDatabase,
} from './scannerAssistantPageTestSupport'
import { createCalibrationTestFixture } from './scannerCalibrationTestFixture'

const runtime = vi.hoisted(() => ({ snapshot: {} as Record<string, unknown> }))
const evidence = vi.hoisted(() => ({ request: vi.fn() }))
const commands = createScannerRuntimeCommands(vi.fn)
vi.mock('../scanner/runtime', () => ({
  useScannerAssistantRuntime: () => ({ snapshot: runtime.snapshot, commands }),
}))
vi.mock('../scanner/detailEvidenceClient', () => ({
  requestScannerDetailEvidence: evidence.request,
}))

describe('manual scanner calibration journey', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetScannerPageTestDatabase()
    window.history.pushState({}, '', '/system/scanner')
    evidence.request.mockRejectedValue(new Error('helper disconnected'))
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    await cleanupScannerPageTestDatabase()
  })

  it('retains partial corrections across reload and imports only after all three records pass and explicit confirmation', async () => {
    const user = userEvent.setup()
    const fixture = createCalibrationTestFixture()
    const account = await createAccount('手动校准测试账户', database, {
      id: 'account-calibration-sample',
    })
    await setActiveAccount(account.id, database)
    const binding = createScannerTargetAccountBinding({ account, baselineDiscCount: 0 })
    saveScannerTargetAccountBinding(binding)
    runtime.snapshot = fixture.snapshot
    commands.requestResultFile.mockResolvedValue({
      resultFileHandle: fixture.snapshot.summary.resultFileHandle,
      resultStatus: 'needs_review',
      accountWriteEnabled: false,
    })
    commands.requestResultStaging.mockResolvedValue(fixture.staging)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    if (process.env.SODA_SCANNER_CALIBRATION_FIXTURE) {
      const path = process.env.SODA_SCANNER_CALIBRATION_FIXTURE
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify({ ...fixture, account, binding }))
    }
    const before = await database.accounts.toArray()
    const view = render(<App />)
    await user.click(
      await screen.findByRole('button', { name: '检查需确认的记录' }, { timeout: 10_000 }),
    )
    expect(screen.queryByRole('button', { name: '手动校准未识别记录' })).not.toBeInTheDocument()
    await screen.findByText('暂时无法读取盘面')
    expect(screen.getByText('还需处理 2 张')).toBeInTheDocument()
    expect(screen.queryByLabelText(/锁定/)).not.toBeInTheDocument()
    await choosePlayerSelect(
      screen.getByRole('combobox', { name: '套装名称' }),
      fixture.answers[0].setId!,
    )
    await choosePlayerSelect(screen.getByRole('combobox', { name: '副词条 1' }), 'crit_dmg')
    await user.type(screen.getByRole('spinbutton', { name: '副词条 1 数值' }), '14.4')
    await user.click(screen.getByRole('button', { name: '保存并下一张' }))
    await screen.findByRole('form', { name: '校准第 2 张驱动盘' })
    expect(await screen.findByText('还需处理 1 张')).toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
    const saved = await database.accountScanImportItems
      .where('accountId')
      .equals(account.id)
      .sortBy('sequence')
    expect(saved[0].state).toBe('ready')
    expect(saved[0].confirmations).toHaveLength(1)
    expect(saved[0].confirmations[0].fields).toEqual(['setName', 'subStats.0'])
    expect(saved[0].evidence).toEqual(fixture.staging.items[0].evidence)
    view.unmount()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '检查需确认的记录' }))
    await screen.findByRole('form', { name: '校准第 2 张驱动盘' })
    // Invalid values cannot silently enter staging or unlock import.
    await user.click(screen.getByRole('button', { name: '保存并检查' }))
    expect(screen.getByText('请先处理下方提示，再保存这张盘。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认更新驱动盘' })).not.toBeInTheDocument()
    const mainValue = screen.getByRole('spinbutton', { name: '主词条数值' })
    await user.clear(mainValue)
    await user.type(mainValue, String(fixture.answers[1].mainStatValue))
    await user.click(screen.getByRole('button', { name: '保存并检查' }))
    const confirm = await screen.findByRole('button', { name: '确认更新驱动盘' })
    await waitFor(() => expect(confirm).toBeEnabled())
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accounts.toArray()).toEqual(before)
    await user.click(confirm)
    await waitFor(async () => expect(await database.accountDriveDiscs.count()).toBe(3))
    expect(fetcher).not.toHaveBeenCalled()
    expect(commands.startScan).not.toHaveBeenCalled()
  }, 20_000)
})
