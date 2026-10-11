import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import App from '../App'

it('redirects the old data center to account maintenance while scanner stays primary', async () => {
  window.history.pushState({}, '', '/system/data')
  render(<App />)

  await vi.dynamicImportSettled()

  await waitFor(() => expect(window.location.pathname).toBe('/assets/account'), { timeout: 10000 })
  expect(
    screen.getByRole('navigation', { name: '主导航' }).querySelector('a[href="/system/scanner"]'),
  ).not.toBeNull()
}, 15000)
