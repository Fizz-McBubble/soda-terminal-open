import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppLoadingState } from './AppEntryState'

afterEach(() => vi.useRealTimers())

describe('brief loading states', () => {
  it('keeps the route heading visible while delaying a short-lived loading message', () => {
    vi.useFakeTimers()
    render(<AppLoadingState heading="代理人养成" title="正在整理养成建议" compact />)
    expect(screen.getByRole('heading', { name: '代理人养成' })).toBeInTheDocument()
    expect(screen.queryByText('正在整理养成建议')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1200))
    expect(screen.getByRole('heading', { name: '代理人养成' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('正在整理养成建议')
  })

  it('does not show a standalone loading card for a read that resolves quickly', () => {
    vi.useFakeTimers()
    const { unmount } = render(<AppLoadingState title="正在打开页面" />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1199))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    unmount()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an inline status when a page read takes longer', () => {
    vi.useFakeTimers()
    render(<AppLoadingState title="正在读取养成资料" compact />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1200))
    expect(screen.getByRole('status')).toHaveTextContent('正在读取养成资料')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('keeps a longer initial read as a status within the page rather than a separate screen', () => {
    vi.useFakeTimers()
    render(<AppLoadingState title="正在读取本地资料" />)
    act(() => vi.advanceTimersByTime(1200))
    expect(screen.getByRole('status')).toHaveTextContent('正在读取本地资料')
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
