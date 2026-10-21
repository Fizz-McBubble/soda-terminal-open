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
test('retains reviewed candidate evidence through receiver storage and Owner readback', async () => {
  const candidateReport = {
    ...report,
    evidence: {
      ...report.evidence,
      candidateStatus: 'validation_failed',
      candidateIssueCount: 7,
    },
  }
  assert.deepEqual(sanitizeScanFeedbackPayload(candidateReport), {
    ok: true,
    record: candidateReport,
  })
  for (const evidence of [
    { status: 'validation_failed' },
    { issues: ['private issue body'] },
    { candidateStatus: 'private status' },
    { candidateIssueCount: 101 },
    { candidateIssueCount: 1.5 },
  ])
    assert.equal(
      sanitizeScanFeedbackPayload({
        ...candidateReport,
        evidence: { ...candidateReport.evidence, ...evidence },
      }).status,
      400,
    )

  const records = new Map()
  const receiver = createScanFeedbackReceiver({
    now: () => Date.parse('2026-10-17T00:00:00Z'),
    feedbackStore: {
      get: async (key) => records.get(key) ?? null,
      put: async (key, value) => records.set(key, value),
    },
  })
  const response = await receiver(
    new Request('https://sodaterminal.com/_soda/scan-feedback', {
      method: 'POST',
      headers: { origin: 'https://sodaterminal.com', 'content-type': 'application/json' },
      body: JSON.stringify(candidateReport),
    }),
    {
      SODA_SCAN_FEEDBACK: 'enabled',
      SODA_RELEASE_ID: candidateReport.release,
      SODA_PUBLIC_ORIGIN: 'https://sodaterminal.com',
    },
  )
  assert.equal(response.status, 200)
  const [stored] = records.values()
  const { receivedAt, ...retrieved } = JSON.parse(stored)
  assert.ok(Number.isFinite(Date.parse(receivedAt)))
  const ownerValidation = sanitizeScanFeedbackPayload(retrieved)
  assert.equal(ownerValidation.ok, true)
  assert.deepEqual(ownerValidation.record, candidateReport)
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

  // Owner retrieval readback verification
  const { receivedAt, ...retrievedRecord } = JSON.parse(stored.value)
  assert.ok(Number.isFinite(Date.parse(receivedAt)))
  const ownerValidation = sanitizeScanFeedbackPayload(retrievedRecord)
  assert.equal(ownerValidation.ok, true)
  assert.deepEqual(ownerValidation.record, report)

  for (const [index, bridge] of ['1.0.5', '1.0.12', '1.1.0'].entries()) {
  // Carry Bridge versions while retaining previously published diagnostic identities.
  const bridgeReport = {
    ...report,
    reportId: 'c7b28014-9ff5-4e3a-96e0-' + String(index).padStart(12, '0'),
    versions: { bridge, protocol: '1' },
    code: 'capture_failed',
  }
  const bridgeRes = await send(bridgeReport)
  assert.equal(bridgeRes.status, 200)
  const [bKey, bEntry] = [...records.entries()].find(([k]) =>
    k.startsWith(bridgeReport.reportId + ':'),
  )
  assert.ok(bKey)
  const { receivedAt: bReceivedAt, ...bRetrieved } = JSON.parse(bEntry.value)
  assert.ok(Number.isFinite(Date.parse(bReceivedAt)))
  const bValidation = sanitizeScanFeedbackPayload(bRetrieved)
  assert.equal(bValidation.ok, true)
  assert.deepEqual(bValidation.record, bridgeReport)

  }
  assert.equal(records.size, 4)
})
