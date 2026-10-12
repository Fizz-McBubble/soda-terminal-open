import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssetMaintenanceGolden } from './AssetMaintenanceGolden'
import { assetGoldenProps } from './AssetMaintenanceGolden.testFixtures'

function setup() {
  const props = assetGoldenProps([])
  props.initialTab = 'account'
  props.accountOptions.push({ id: 'account-other', displayName: '另一个账户' })
  return props
}

describe('account management renaming', () => {
  it('allows each row to rename its own account and cancel without saving', () => {
    const props = setup()
    render(<AssetMaintenanceGolden {...props} />)
    const rows = within(screen.getByRole('list', { name: '本机账户列表' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      const opener = within(row).getByRole('button', { name: '重命名' })
      fireEvent.click(opener)
      const dialog = screen.getByRole('dialog', { name: '重命名账户' })
      expect(within(dialog).getByLabelText('账户名称')).toHaveValue(
        within(row).getByRole('strong').textContent,
      )
      fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(opener).toHaveFocus()
    }
    expect(props.onRenameAccount).not.toHaveBeenCalled()
  })

  it('validates whitespace, trims the saved name and guards pending cancellation and double submit', async () => {
    const props = setup()
    let finish!: () => void
    props.onRenameAccount = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    render(<AssetMaintenanceGolden {...props} />)
    fireEvent.click(screen.getAllByRole('button', { name: '重命名' })[1])
    const dialog = screen.getByRole('dialog', { name: '重命名账户' })
    const input = within(dialog).getByLabelText('账户名称')
    const form = dialog.querySelector('form')!
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(form)
    expect(within(dialog).getByRole('alert')).toHaveTextContent('不能为空')
    expect(props.onRenameAccount).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '  新名字  ' } })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(props.onRenameAccount).toHaveBeenCalledExactlyOnceWith('account-other', '新名字')
    expect(input).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeDisabled()
    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    await act(async () => finish())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('retains the typed name after a failed save and supports retry', async () => {
    const props = setup()
    props.onRenameAccount = vi
      .fn()
      .mockRejectedValueOnce(new Error('暂时无法保存'))
      .mockResolvedValueOnce(undefined)
    render(<AssetMaintenanceGolden {...props} />)
    fireEvent.click(screen.getAllByRole('button', { name: '重命名' })[0])
    const dialog = screen.getByRole('dialog', { name: '重命名账户' })
    fireEvent.change(within(dialog).getByLabelText('账户名称'), { target: { value: '重试名字' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('暂时无法保存')
    expect(within(dialog).getByLabelText('账户名称')).toHaveValue('重试名字')
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(props.onRenameAccount).toHaveBeenCalledTimes(2)
  })
})
