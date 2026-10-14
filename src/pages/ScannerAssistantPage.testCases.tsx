import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import type { ComponentType } from 'react'
import { createAccount, setActiveAccount } from '../accounts/repository'
import type { database as AppDatabase } from '../db/database'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'

export function registerScannerAssistantAccountCases(context: {
  App: ComponentType
  database: typeof AppDatabase
  setRuntimeState: (state: string) => void
}) {
  it('can create an isolated scan account without replacing an existing account', async () => {
    const user = userEvent.setup()
    const existing = await createAccount('既有验收账户', context.database, {
      id: 'account-existing',
    })
    await setActiveAccount(existing.id, context.database)
    context.setRuntimeState('ready')
    render(<context.App />)

    await screen.findByRole('textbox', { name: '新账户名称' })
    const accountName = screen.getByRole('textbox', { name: '新账户名称' })
    expect(accountName).toBeVisible()
    expect(accountName.closest('details')).toBeNull()
    await user.type(accountName, '真实扫描账户')
    await user.click(screen.getByRole('button', { name: '创建并选用' }))

    await waitFor(async () => expect(await context.database.accounts.count()).toBe(2))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: '目标账户' })).toHaveTextContent('真实扫描账户'),
    )
    expect(await context.database.accounts.get('account-existing')).toMatchObject({
      displayName: '既有验收账户',
      status: 'active',
    })
  })

  it('uses the shared account selector without loading account imagery', async () => {
    const alphaName = 'F4X Current HEAD 完整主账户名称'
    const betaName = 'F4X Current HEAD 完整备用账户名称'
    const alpha = await createAccount(alphaName, context.database, { id: 'account-alpha' })
    await createAccount(betaName, context.database, { id: 'account-beta' })
    await setActiveAccount(alpha.id, context.database)
    context.setRuntimeState('ready')
    render(<context.App />)

    const picker = await screen.findByRole('combobox', { name: '目标账户' })
    expect(picker).toHaveTextContent(alphaName)
    await choosePlayerSelect(picker, 'account-beta')
    await waitFor(() => expect(picker).toHaveValue('account-beta'))
    expect(picker).toHaveTextContent(betaName)
    expect(picker).toHaveFocus()
  })
}
