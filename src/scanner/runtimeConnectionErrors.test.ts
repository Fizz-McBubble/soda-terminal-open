import { expect, it } from 'vitest'
import { connectionFailure } from './runtimeConnectionErrors'
import { diagnosticFromSnapshot } from './diagnostics'
import { readySnapshot } from './runtime.testFixture'
import { sanitizeScanFeedbackPayload } from '../../deploy/cloudflare/scan-feedback.mjs'

it('keeps the last scan count and verified version when the event stream dies', () => {
  const id = crypto.randomUUID()
  const failed = connectionFailure(new Error('helper_events_disconnected'), {
    reportId: id,
    step: 'events',
    versions: { installer: '1.1.0', helper: '2.3.12', protocol: '5' },
    lastSnapshot: {
      ...readySnapshot,
      state: 'scanning',
      progress: { processed: 36, total: 1378, stageLabel: 'private', etaSeconds: null },
    },
  })
  const report = diagnosticFromSnapshot(failed, id, 'helper_unavailable')
  expect(report).toMatchObject({
    counts: { processed: 36, total: 1378 },
    versions: { installer: '1.1.0' },
    evidence: {
      diagnosticSource: 'browser_connection',
      connectionStep: 'events',
      connectionFailure: 'disconnected',
    },
  })
  expect(JSON.stringify(report)).not.toContain('private')
  expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
})

it('records where an initial connection failed without guessing the browser permission or leaking errors', () => {
  const report = diagnosticFromSnapshot(
    connectionFailure(new TypeError('private network address'), {
      reportId: crypto.randomUUID(),
      step: 'identity',
      lastSnapshot: {
        ...readySnapshot,
        state: 'completed',
        progress: { processed: 374, total: 374, stageLabel: 'old', etaSeconds: 0 },
      },
    }),
    crypto.randomUUID(),
  )
  expect(report.evidence).toEqual({
    diagnosticSource: 'browser_connection',
    connectionStep: 'identity',
    connectionFailure: 'network',
  })
  expect(report.counts).toEqual({ processed: null, total: null })
  expect(JSON.stringify(report)).not.toMatch(/private|permission_denied|old/)
})
