import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssetMaintenanceGolden } from './AssetMaintenanceGolden'
import { assetGoldenDisc, assetGoldenProps } from './AssetMaintenanceGolden.testFixtures'

const largeProps = () =>
  assetGoldenProps(
    Array.from({ length: 3000 }, (_, index) => ({
      ...assetGoldenDisc(`disc-${String(index).padStart(4, '0')}`, `r${index}`),
      tags: [`tag-${index}`],
    })),
  )
const cards = () => within(screen.getByRole('listbox')).getAllByRole('option')

describe('bounded asset catalog rendering', () => {
  it('opens the page containing a deep-linked selected disc', () => {
    render(<AssetMaintenanceGolden {...largeProps()} initialSelection={{ discs: 'disc-2999' }} />)
    expect(cards()).toHaveLength(120)
    expect(screen.getByText('第 25 / 25 页 · 显示 2881–3000 / 3000')).toBeInTheDocument()
    expect(cards()[119]).toHaveAttribute('aria-selected', 'true')
  })
  it('renders 120 of 3000 while searches and clears retain full counts', () => {
    render(<AssetMaintenanceGolden {...largeProps()} />)
    expect(cards()).toHaveLength(120)
    expect(screen.getByText('3000 / 3000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByText('第 2 / 25 页 · 显示 121–240 / 3000')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索名称'), { target: { value: 'tag-2999' } })
    expect(cards()).toHaveLength(1)
    expect(screen.getByText('1 / 3000')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索名称'), { target: { value: '' } })
    expect(cards()).toHaveLength(120)
    expect(screen.getByText('第 1 / 25 页 · 显示 1–120 / 3000')).toBeInTheDocument()
  })

  it('moves focus across pages and reveals an off-page selection', async () => {
    render(<AssetMaintenanceGolden {...largeProps()} />)
    cards()[119]!.focus()
    fireEvent.keyDown(cards()[119]!, { key: 'ArrowRight' })
    await waitFor(() => expect(cards()[0]).toHaveFocus())
    expect(screen.getByText('第 2 / 25 页 · 显示 121–240 / 3000')).toBeInTheDocument()
    fireEvent.keyDown(cards()[0]!, { key: 'ArrowLeft' })
    await waitFor(() => expect(cards()[119]).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByText('此对象不在当前页。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '在列表中显示' }))
    await waitFor(() => expect(cards()[0]).toHaveFocus())
    expect(screen.getByText('第 1 / 25 页 · 显示 1–120 / 3000')).toBeInTheDocument()
  })

  it('keeps bulk selections across pages and deletes the exact global identity/revision snapshot', async () => {
    const props = largeProps()
    render(<AssetMaintenanceGolden {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '批量删除驱动盘' }))
    fireEvent.click(cards()[0]!)
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    fireEvent.click(cards()[0]!)
    expect(screen.getByText('2 张已选择')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '删除所选驱动盘' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('删除确认'), { target: { value: '删除 2 张' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '确认删除 2 张驱动盘' }))
    await waitFor(() =>
      expect(props.onDeleteDiscs).toHaveBeenCalledWith(['disc-0000', 'disc-0120'], {
        'disc-0000': 'r0',
        'disc-0120': 'r120',
      }),
    )
  })
})
