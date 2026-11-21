import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect } from 'vitest'
import { ScannerAssistantPage } from './ScannerAssistantPage'
import { database } from '../db/database'
import { syntheticWorkbenchQuickSnapshot } from './ScannerAssistantPage.workbench.syntheticfixture'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'

function page() {
  return (
    <MemoryRouter>
      <ScannerAssistantPage />
    </MemoryRouter>
  )
}

export async function showPage() {
  const result = render(page())
  await screen.findByRole('region', { name: '本次操作目标账户' })
  return result
}

export function assertFocusedWorkspace() {
  expect(screen.getByRole('complementary', { name: '非官方工具风险提示' })).toBeVisible()
  expect(document.getElementById('scanner-workbench-guides')).toBeNull()
  expect(screen.getByRole('region', { name: '采集方式与风险说明' })).toBeVisible()
}

export async function facts() {
  return {
    discs: await database.accountDriveDiscs.toArray(),
    rosters: await database.accountRosters.toArray(),
    accounts: await database.accounts.toArray(),
    batches: await database.accountScanImportBatches.toArray(),
  }
}

export function quickFile(snapshot = syntheticWorkbenchQuickSnapshot()) {
  const text = JSON.stringify(snapshot)
  const file = new File([text], 'synthetic-workbench-quick.json', { type: 'application/json' })
  Object.defineProperties(file, {
    text: { value: async () => text },
    arrayBuffer: { value: async () => new TextEncoder().encode(text).buffer },
  })
  return file
}

export async function prepareQuick() {
  fireEvent.change(screen.getByLabelText('游戏安装目录'), {
    target: { value: "soda-source-ref:ee09b7b910b89ca3d044849bf8cbb524" },
  })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  fireEvent.click(screen.getByRole('checkbox', { name: /我已了解上方账号风险/ }))
  await waitFor(() => expect(screen.getByRole('button', { name: '一键读取' })).toBeEnabled())
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '一键读取' })))
}

export async function assertWorkbenchAccountChoiceWithoutRead(bridgeStart: unknown) {
  await showPage()
  await choosePlayerSelect(
    screen.getByRole('combobox', { name: '目标账户' }),
    'account-workbench-other',
  )
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: '目标账户' })).toHaveTextContent('合成备用账户'),
  )
  expect(screen.queryByRole('button', { name: '使用所选接收账户' })).not.toBeInTheDocument()
  expect(bridgeStart).not.toHaveBeenCalled()
  expect(await database.accountDriveDiscs.count()).toBe(0)
}
