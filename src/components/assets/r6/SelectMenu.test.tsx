import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { SelectMenu } from './SelectMenu'

describe('SelectMenu shared popover contract', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([false, true])(
    'matches trigger zoom without double scaling the dialog portal (%s)',
    (inDialog) => {
      const selector = (
        <SelectMenu
          label="缩放筛选"
          value="a"
          options={[
            { value: 'a', label: '甲' },
            { value: 'b', label: '乙' },
          ]}
          onChange={vi.fn()}
        />
      )
      render(
        <div style={{ zoom: 4 / 3 }}>
          {inDialog ? (
            <dialog open>
              <form>{selector}</form>
            </dialog>
          ) : (
            selector
          )}
        </div>,
      )
      const trigger = screen.getByRole('button', { name: '缩放筛选' })
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        left: 200,
        right: 440,
        top: 100,
        bottom: 156,
        width: 240,
        height: 56,
      } as DOMRect)
      fireEvent.click(trigger)
      const listbox = screen.getByRole('listbox', { name: '缩放筛选' })
      expect(Number(listbox.style.zoom)).toBeCloseTo(inDialog ? 1 : 4 / 3)
      expect((Number.parseFloat(listbox.style.left) * 4) / 3).toBeCloseTo(200)
      expect((Number.parseFloat(listbox.style.top) * 4) / 3).toBeCloseTo(162)
      expect((Number.parseFloat(listbox.style.width) * 4) / 3).toBeCloseTo(240)
    },
  )

  it('supports typing to choose and prevents interaction while disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = {
      label: '选择',
      value: 'a',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ],
      onChange,
    }
    const { rerender } = render(<SelectMenu {...props} />)
    screen.getByRole('button', { name: '选择' }).focus()
    await user.keyboard('b{Enter}')
    expect(onChange).toHaveBeenCalledWith('b')
    await user.click(screen.getByRole('button', { name: '选择' }))
    rerender(<SelectMenu {...props} disabled />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '选择' })).toHaveAttribute('aria-expanded', 'false')
    rerender(<SelectMenu {...props} />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '选择' }))
    expect(screen.getByRole('listbox')).toBeVisible()
  })
  it('does not present the first option as a selection after the selected record disappears', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SelectMenu
        label="音擎"
        value="saved"
        options={[{ value: 'saved', label: '原音擎' }]}
        onChange={onChange}
      />,
    )
    rerender(
      <SelectMenu
        label="音擎"
        value="saved"
        options={[{ value: 'other', label: '其他音擎' }]}
        onChange={onChange}
      />,
    )
    expect(screen.getByRole('button', { name: '音擎' })).toHaveTextContent('请选择')
    expect(onChange).not.toHaveBeenCalled()
  })

  it.each([undefined, -1])(
    'skips hidden disclosure controls (summary tabIndex=%s)',
    async (tabIndex) => {
      const user = userEvent.setup()
      render(
        <>
          <SelectMenu
            label="选择"
            value="a"
            options={[{ value: 'a', label: '甲' }]}
            onChange={vi.fn()}
          />
          <details>
            <summary tabIndex={tabIndex}>更多筛选</summary>
            <button>隐藏操作</button>
          </details>
          <button>下一步</button>
        </>,
      )
      await user.click(screen.getByRole('button', { name: '选择' }))
      await user.tab()
      expect(screen.getByText(tabIndex === -1 ? '下一步' : '更多筛选')).toHaveFocus()
    },
  )
  it('focuses the selected option on first open and returns to the trigger after choosing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SelectMenu
        label="选择"
        value="b"
        options={[
          { value: 'a', label: '甲' },
          { value: 'b', label: '乙' },
        ]}
        onChange={onChange}
      />,
    )
    const trigger = screen.getByRole('button', { name: '选择' })
    await user.click(trigger)
    expect(screen.getByRole('option', { name: '乙' })).toHaveFocus()
    await user.keyboard('{ArrowUp}{Enter}')
    expect(onChange).toHaveBeenCalledWith('a')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it.each([false, true])(
    'closes on Tab and moves from the trigger in the correct direction (shift=%s)',
    async (shift) => {
      const user = userEvent.setup()
      render(
        <>
          <button>之前</button>
          <SelectMenu
            label="选择"
            value="a"
            options={[{ value: 'a', label: '甲' }]}
            onChange={vi.fn()}
          />
          <button>之后</button>
        </>,
      )
      await user.click(screen.getByRole('button', { name: '选择' }))
      expect(screen.getByRole('option')).toHaveFocus()
      await user.tab({ shift })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: shift ? '之前' : '之后' })).toHaveFocus()
    },
  )

  it('opens with arrow keys and navigates in visible grouped order, skipping disabled options', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SelectMenu
        label="分组"
        value="grouped"
        options={[
          { value: 'grouped', label: '组内已选', group: '推荐' },
          { value: 'none', label: '不选择' },
          { value: 'disabled', label: '不可选', group: '推荐', disabled: true },
          { value: 'other', label: '组内其他', group: '推荐' },
        ]}
        onChange={onChange}
      />,
    )
    screen.getByRole('button', { name: '分组' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: '组内已选' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: '组内其他' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('option', { name: '不选择' })).toHaveFocus()
    await user.keyboard('{End}{Enter}')
    expect(onChange).toHaveBeenCalledWith('other')
  })

  it('portals the listbox outside a clipping container and renders the local equipment slot', () => {
    const onChange = vi.fn()
    const view = render(
      <div data-testid="clipping-dialog" style={{ overflow: 'hidden' }}>
        <SelectMenu
          label="音擎副本"
          value="copy-1"
          options={[
            { value: '', label: '未绑定' },
            {
              value: 'copy-1',
              label: '空羽复归之诗 · S级 · Lv 60 · 精1',
              visual: { entityId: 'wengine-14158', name: '空羽复归之诗' },
            },
          ]}
          onChange={onChange}
        />
      </div>,
    )

    const trigger = screen.getByRole('button', { name: '音擎副本' })
    expect(trigger.querySelector('[data-visual-slot="wengine.equipment-icon"]')).toBeTruthy()
    fireEvent.click(trigger)

    const listbox = screen.getByRole('listbox', { name: '音擎副本' })
    expect(listbox.parentElement).toBe(document.body)
    expect(view.getByTestId('clipping-dialog').contains(listbox)).toBe(false)
    expect(
      within(listbox)
        .getByRole('option', { name: /空羽复归之诗/ })
        .querySelector('[data-visual-slot="wengine.equipment-icon"]'),
    ).toBeTruthy()

    fireEvent.click(within(listbox).getByRole('option', { name: '未绑定' }))
    expect(onChange).toHaveBeenCalledWith('')
    expect(screen.queryByRole('listbox', { name: '音擎副本' })).toBeNull()
  })

  it('keeps Escape and outside-click dismissal keyboard-safe', () => {
    render(
      <SelectMenu
        label="筛选"
        value="all"
        options={[
          { value: 'all', label: '全部' },
          { value: 'owned', label: '已拥有' },
        ]}
        onChange={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: '筛选' })
    fireEvent.click(trigger)
    const listbox = screen.getByRole('listbox', { name: '筛选' })
    fireEvent.keyDown(listbox, { key: 'Escape' })
    expect(screen.queryByRole('listbox', { name: '筛选' })).toBeNull()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    expect(screen.getByRole('listbox', { name: '筛选' })).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox', { name: '筛选' })).toBeNull()
  })

  it('keeps options inside a native dialog so the modal does not make them inert', () => {
    const onChange = vi.fn()
    render(
      <dialog open>
        <form>
          <SelectMenu
            label="当前音擎"
            value="current"
            options={[
              { value: 'current', label: '空羽复归之诗' },
              { value: 'alternative', label: '双生泣星' },
            ]}
            onChange={onChange}
          />
        </form>
      </dialog>,
    )

    fireEvent.click(screen.getByRole('button', { name: '当前音擎' }))
    const listbox = screen.getByRole('listbox', { name: '当前音擎' })
    expect(listbox.closest('dialog form')).toBeTruthy()
    fireEvent.click(within(listbox).getByRole('option', { name: '双生泣星', hidden: true }))
    expect(onChange).toHaveBeenCalledWith('alternative')
  })

  it('keeps Escape scoped to the menu when it is opened inside a dialog', async () => {
    const dialogKeyDown = vi.fn()
    render(
      <dialog open onKeyDown={dialogKeyDown}>
        <form>
          <SelectMenu
            label="当前音擎"
            value="current"
            options={[
              { value: 'current', label: '空羽复归之诗' },
              { value: 'alternative', label: '双生泣星' },
            ]}
            onChange={vi.fn()}
          />
        </form>
      </dialog>,
    )

    const trigger = screen.getByRole('button', { name: '当前音擎' })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('listbox', { name: '当前音擎' }), { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: '当前音擎' })).toBeNull()
      expect(document.activeElement).toBe(trigger)
    })
    expect(dialogKeyDown).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '当前音擎' }).closest('dialog')).toHaveAttribute(
      'open',
    )
  })
})
