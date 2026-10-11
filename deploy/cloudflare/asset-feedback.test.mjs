import assert from 'node:assert/strict'
import test from 'node:test'
import { createScanFeedbackReceiver, sanitizeScanFeedbackPayload } from './scan-feedback.mjs'
const report = {
  schema: 1,
  tool: 'asset_quick_read',
  reportId: 'c7b28014-9ff5-4e3a-96e0-20f781df03aa',
  release: 'soda-release-20261007',
  outcome: 'failed',
  stage: 'waiting',
  code: 'wait_timeout',
  versions: { bridge: '1.0.1', protocol: '1' },
  counts: { processed: null, total: null },
  durationMs: null,
  environment: {},
  evidence: { candidateAvailable: false, remainingSeconds: 0 },
}
test('asset receiver strictly rejects raw/private facts and cross-tool whitelist fields', () => {
  assert.equal(sanitizeScanFeedbackPayload(report).ok, true)
  for (const privateField of ['accountId', 'snapshot', 'path', 'message', 'token', 'traffic'])
    assert.equal(sanitizeScanFeedbackPayload({ ...report, [privateField]: 'private' }).status, 400)
  for (const fields of [
    { tool: 'other' },
    { stage: 'ocr' },
    { code: 'panel_capture_timeout' },
    { versions: { scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r1' } },
    { environment: { width: 1920 } },
    { evidence: { snapshot: {} } },
  ])
    assert.equal(sanitizeScanFeedbackPayload({ ...report, ...fields }).status, 400)
})
test('uses existing receiver and KV TTL, immutable content addressing and stable retry receipt', async () => {
  const records = new Map()
  const receiver = createScanFeedbackReceiver({
    now: () => Date.parse('2026-10-11T00:00:00Z'),
    feedbackStore: {
      get: async (key) => records.get(key)?.value ?? null,
      put: async (key, value, options) => records.set(key, { value, options }),
    },
  })
  const env = {
    SODA_SCAN_FEEDBACK: 'enabled',
    SODA_RELEASE_ID: 'soda-release-current',
    SODA_PUBLIC_ORIGIN: 'https://sodaterminal.com',
  }
  const send = (payload) =>
    receiver(
      new Request('https://sodaterminal.com/_soda/scan-feedback', {
        method: 'POST',
        headers: { origin: 'https://sodaterminal.com', 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      env,
    )
  const first = await send(report)
  assert.equal(first.status, 200)
  assert.deepEqual(await (await send(report)).json(), await first.json())
  assert.equal(records.size, 1)
  const stored = [...records.values()][0]
  assert.equal(stored.options.expirationTtl, 30 * 86400)
  assert.equal(JSON.parse(stored.value).tool, 'asset_quick_read')
  assert.equal((await send({ ...report, code: 'capture_failed' })).status, 200)
  assert.equal(records.size, 2)
})
