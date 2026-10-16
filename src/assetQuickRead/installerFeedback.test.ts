import { describe, expect, it, vi } from 'vitest'
import {
  consumeInstallerFeedbackFragment,
  readInstallerReceipt,
  readLastInstallerReceipt,
  installerReceiptStorageKey,
  sanitizeInstallerFeedback,
  saveInstallerReceipt,
  submitInstallerFeedback,
  type InstallerFeedbackReport,
} from './installerFeedback'

const sampleReport: InstallerFeedbackReport = {
  schema: 1,
  tool: 'asset_quick_read_installer',
  reportId: 'c7b28014-9ff5-4e3a-96e0-20f781df03aa',
  installerVersion: '1.0.9',
  stage: 'protocol',
  code: 'protocol_download_timeout',
  durationMs: 42000,
  attempts: [
    {
      item: 0,
      source: 'github_raw',
      code: 'request_started',
      elapsedMs: 50,
    },
    {
      item: 0,
      source: 'github_raw',
      code: 'protocol_download_timeout',
      elapsedMs: 20000,
    },
  ],
}

describe('installerFeedback sanitization and fragment consumption', () => {
  it('accepts the fixed official archive source without accepting arbitrary hosts or paths', () => {
    const report = {
      ...sampleReport,
      attempts: [{ item: 0, source: 'github_archive', code: 'verified', elapsedMs: 50 }],
    }
    expect(sanitizeInstallerFeedback(report)).toEqual(report)
    for (const source of ['https://untrusted.example/archive', 'private-path', 'github_mirror'])
      expect(
        sanitizeInstallerFeedback({
          ...report,
          attempts: [{ ...report.attempts[0], source }],
        }),
      ).toBeNull()
  })
  it('accepts scanner installation diagnostics while rejecting cross-tool facts', () => {
    const scanner = {
      ...sampleReport,
      tool: 'screen_scanner_installer',
      installerVersion: '1.1.6',
      stage: 'verify',
      code: 'runtime_health_probe_timeout',
      attempts: [],
    }
    for (const installerVersion of ['1.1.6', '1.2.0']) {
      const report = { ...scanner, installerVersion }
      expect(sanitizeInstallerFeedback(report)).toEqual(report)
      const replaceState = vi.fn()
      expect(
        consumeInstallerFeedbackFragment(
          { hash: `#${encodeURIComponent(JSON.stringify(report))}`, pathname: '/installer-feedback' },
          { replaceState },
        ),
      ).toEqual(report)
      expect(replaceState).toHaveBeenCalledWith(null, '', '/installer-feedback')
    }
    for (const patch of [
      { stage: 'protocol' },
      { code: 'protocol_download_timeout' },
      { installerVersion: '1.0.9' },
      { installerVersion: '9.9.9' },
      { attempts: sampleReport.attempts },
      { path: 'private-path' },
      { rawerror: 'private-error' },
    ])
      expect(sanitizeInstallerFeedback({ ...scanner, ...patch })).toBeNull()
    expect(sanitizeInstallerFeedback({ ...sampleReport, code: scanner.code })).toBeNull()
  })
  it('accepts valid installer feedback DTO', () => {
    const safe = sanitizeInstallerFeedback(sampleReport)
    expect(safe).not.toBeNull()
    expect(safe?.reportId).toBe(sampleReport.reportId)
    expect(safe?.tool).toBe('asset_quick_read_installer')
  })

  it('accepts next release 1.1.0 installer diagnostics while rejecting future out-of-range versions', () => {
    const nextReleaseReport = { ...sampleReport, installerVersion: '1.1.0' }
    const safe = sanitizeInstallerFeedback(nextReleaseReport)
    expect(safe).not.toBeNull()
    expect(safe?.installerVersion).toBe('1.1.0')

    for (const invalidVersion of ['1.2.0', '2.0.0', '0.9.0', '1.0.0.0']) {
      expect(
        sanitizeInstallerFeedback({ ...sampleReport, installerVersion: invalidVersion }),
      ).toBeNull()
    }
  })

  it('strictly rejects sensitive and unknown fields', () => {
    const sensitiveKeys = [
      'processId',
      'executableSha256',
      'registration_identity',
      'localpath',
      'URLs',
      'rawerror',
      'account',
      'traffic',
      'environment',
      'release',
    ]
    for (const key of sensitiveKeys) {
      const copy = { ...sampleReport, [key]: 'secret' }
      expect(sanitizeInstallerFeedback(copy)).toBeNull()
    }
  })

  it('rejects unclassified codes or invalid stages', () => {
    expect(sanitizeInstallerFeedback({ ...sampleReport, code: 'raw_io_exception' })).toBeNull()
    expect(sanitizeInstallerFeedback({ ...sampleReport, stage: 'arbitrary_stage' })).toBeNull()
  })

  it('consumes fragment synchronously and removes it with history.replaceState before tasks', () => {
    const encoded = encodeURIComponent(JSON.stringify(sampleReport))
    const mockLocation = {
      hash: `#${encoded}`,
      pathname: '/installer-feedback',
    }
    const replaceState = vi.fn()
    const mockHistory = { replaceState }

    const report = consumeInstallerFeedbackFragment(mockLocation, mockHistory)
    expect(report).toEqual(sampleReport)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/installer-feedback')
  })

  it('clears malicious or invalid fragment and returns null without error or raw output', () => {
    const mockLocation = {
      hash: '#malformed%invalid%json',
      pathname: '/installer-feedback',
    }
    const replaceState = vi.fn()
    const mockHistory = { replaceState }

    const report = consumeInstallerFeedbackFragment(mockLocation, mockHistory)
    expect(report).toBeNull()
    expect(replaceState).toHaveBeenCalledWith(null, '', '/installer-feedback')
  })

  it('saves and reads receipt correctly with exact report matching', () => {
    const storage = new Map<string, string>()
    const mockStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
      length: 0,
      key: () => null,
    } as Storage

    expect(readInstallerReceipt(sampleReport, mockStorage)).toBeNull()
    const receipt = { report: sampleReport, receivedAt: '2026-10-12T12:00:00.000Z' }
    saveInstallerReceipt(receipt, mockStorage)
    expect(readLastInstallerReceipt(mockStorage)).toEqual(receipt)
    expect(readInstallerReceipt(sampleReport, mockStorage)).toEqual(receipt)

    // Different report does not match receipt
    const otherReport = { ...sampleReport, reportId: '00000000-0000-4000-8000-000000000002' }
    expect(readInstallerReceipt(otherReport, mockStorage)).toBeNull()
  })

  it.each([
    'null',
    '[]',
    '{',
    JSON.stringify({ report: sampleReport, receivedAt: 'invalid' }),
    JSON.stringify({
      report: { ...sampleReport, privatePath: 'private' },
      receivedAt: '2026-10-15T00:00:00Z',
    }),
    JSON.stringify({ report: sampleReport, receivedAt: '2026-10-15T00:00:00Z', extra: 'private' }),
    ' '.repeat(5000),
  ])('rejects malformed or untrusted stored history safely', (raw) => {
    const storage = {
      getItem: (key: string) => (key === installerReceiptStorageKey ? raw : null),
    } as Storage
    expect(readLastInstallerReceipt(storage)).toBeNull()
  })

  it('keeps unavailable local storage a safe empty history', () => {
    const storage = {
      getItem: () => {
        throw new Error('storage blocked')
      },
    } as unknown as Storage
    expect(readLastInstallerReceipt(storage)).toBeNull()
  })

  it('submits feedback with credentials omit and returns receipt on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'received',
        reportId: sampleReport.reportId,
        receivedAt: '2026-10-12T12:00:00.000Z',
      }),
    })

    const receipt = await submitInstallerFeedback(
      sampleReport,
      mockFetch as unknown as typeof fetch,
    )
    expect(receipt.report.reportId).toBe(sampleReport.reportId)
    expect(receipt.receivedAt).toBe('2026-10-12T12:00:00.000Z')

    expect(mockFetch).toHaveBeenCalledWith(
      '/_soda/scan-feedback',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: JSON.stringify(sampleReport),
      }),
    )
  })

  it('throws on network failure or invalid receipt without crashing', async () => {
    const failFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    })

    await expect(
      submitInstallerFeedback(sampleReport, failFetch as unknown as typeof fetch),
    ).rejects.toThrow('retry')
  })
})
