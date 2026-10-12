import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PrepareChecklist } from './ScannerPrepareChecklist'
import { createScannerRuntimeSnapshot } from './scannerAssistantTestFixture'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'

it('keeps every failed preparation check in a collapsed card before the recovery action', () => {
  const onStart = vi.fn()
  render(
    <PrepareChecklist
      compact
      snapshot={createScannerRuntimeSnapshot('connection_failed') as ScannerAssistantSnapshot}
      eyebrow="准备"
      title="检查未完成"
      body="请完成必要准备后重试"
      headingRef={createRef()}
      targetReady
      targetPanel={null}
      accountDisclosure={null}
      onStart={onStart}
      onReconnect={vi.fn()}
    />,
  )
  const details = screen.getByLabelText('实际准备检查结果')
  expect(details).not.toHaveAttribute('open')
  expect(details.querySelectorAll('li')).toHaveLength(3)
  expect(details).toHaveTextContent('1600 × 900')
  expect(details).toHaveTextContent('384 / 3000')
  const action = screen.getByRole('button', { name: '重新扫描' })
  expect(details.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(action)
  expect(onStart).toHaveBeenCalledOnce()
})
