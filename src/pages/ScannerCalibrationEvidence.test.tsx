import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScannerCalibrationEvidence } from './ScannerCalibrationEvidence'
import { createCalibrationTestFixture } from './scannerCalibrationTestFixture'

const evidence = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../scanner/detailEvidenceClient', () => ({
  requestScannerDetailEvidence: evidence.request,
}))
describe('calibration local evidence identity', () => {
  beforeEach(() => vi.clearAllMocks())
  it('discards late images from the previous disc and revokes both local blobs', async () => {
    const [first, second] = createCalibrationTestFixture().staging.items
    type ImageResult = {
      availability: 'available'
      detailSrc: string
      visualDetailHash: string
      revoke: () => void
    }
    let resolveFirst!: (value: ImageResult) => void
    const staleRevoke = vi.fn()
    const currentRevoke = vi.fn()
    evidence.request
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce({
        availability: 'available',
        detailSrc: 'blob:second',
        visualDetailHash: second.evidence.visualDetailHash,
        revoke: currentRevoke,
      })
    const view = render(
      <ScannerCalibrationEvidence item={first} resultFileHandle="synthetic-result" />,
    )
    view.rerender(<ScannerCalibrationEvidence item={second} resultFileHandle="synthetic-result" />)
    expect(await screen.findByRole('img')).toHaveAttribute('src', 'blob:second')
    await act(async () =>
      resolveFirst({
        availability: 'available',
        detailSrc: 'blob:first',
        visualDetailHash: first.evidence.visualDetailHash,
        revoke: staleRevoke,
      }),
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:second')
    expect(staleRevoke).toHaveBeenCalledOnce()
    view.unmount()
    expect(currentRevoke).toHaveBeenCalledOnce()
  })
  it('refuses an image whose hash belongs to another record', async () => {
    const [item] = createCalibrationTestFixture().staging.items
    const revoke = vi.fn()
    evidence.request.mockResolvedValue({
      availability: 'available',
      detailSrc: 'blob:wrong',
      visualDetailHash: 'sha256:wrong',
      revoke,
    })
    render(<ScannerCalibrationEvidence item={item} resultFileHandle="synthetic-result" />)
    await screen.findByText('暂时无法读取盘面')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    await waitFor(() => expect(revoke).toHaveBeenCalledOnce())
  })
})
