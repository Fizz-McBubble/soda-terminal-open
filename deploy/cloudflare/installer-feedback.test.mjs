import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createScanFeedbackReceiver,
  sanitizeInstallerFeedbackPayload,
  sanitizeScanFeedbackPayload,
} from './scan-feedback.mjs'

const validReport = {
  schema: 1,
  tool: 'asset_quick_read_installer',
  reportId: 'c7b28014-9ff5-4e3a-96e0-20f781df03aa',
  installerVersion: '1.0.9',
  stage: 'protocol',
  code: 'protocol_download_timeout',
  durationMs: 25400,
  attempts: [
    {
      item: 0,
      source: 'github_raw',
      code: 'request_started',
      elapsedMs: 120,
    },
    {
      item: 0,
      source: 'github_raw',
      code: 'protocol_download_timeout',
      elapsedMs: 20000,
    },
  ],
}

test('installer receiver accepts only the fixed archive source code', () => {
  const report = {
    ...validReport,
    attempts: [{ item: 0, source: 'github_archive', code: 'verified', elapsedMs: 50 }],
  }
  assert.deepEqual(sanitizeInstallerFeedbackPayload(report).record, report)
  for (const source of ['https://untrusted.example/archive', 'private-path', 'github_mirror'])
    assert.equal(
      sanitizeInstallerFeedbackPayload({
        ...report,
        attempts: [{ ...report.attempts[0], source }],
      }).status,
      400,
    )
})

test('scanner installer uses the same receiver with a separate finite contract', () => {
  const scanner = {
    ...validReport,
    tool: 'screen_scanner_installer',
    installerVersion: '1.1.6',
    stage: 'verify',
    code: 'runtime_health_probe_timeout',
    attempts: [],
  }
  assert.deepEqual(sanitizeScanFeedbackPayload(scanner).record, scanner)
  for (const patch of [
    { stage: 'protocol' },
    { code: 'protocol_download_timeout' },
    { installerVersion: '1.0.9' },
    { attempts: validReport.attempts },
    { path: 'private-path' },
    { rawerror: 'private-error' },
  ])
    assert.equal(sanitizeInstallerFeedbackPayload({ ...scanner, ...patch }).status, 400)
  assert.equal(sanitizeInstallerFeedbackPayload({ ...validReport, code: scanner.code }).status, 400)
})

test('installer feedback strictly validates safe DTO and rejects extraneous/sensitive keys', () => {
  const parsed = sanitizeInstallerFeedbackPayload(validReport)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.record.tool, 'asset_quick_read_installer')
  assert.equal(parsed.record.installerVersion, '1.0.9')

  // Top-level dispatcher routes tool: asset_quick_read_installer to installer validator
  assert.equal(sanitizeScanFeedbackPayload(validReport).ok, true)

  // Rejects extraneous or sensitive facts
  const sensitiveFields = [
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
    'unknownField',
  ]
  for (const field of sensitiveFields) {
    assert.equal(
      sanitizeInstallerFeedbackPayload({ ...validReport, [field]: 'forbidden' }).status,
      400,
      `Should reject sensitive/unknown field: ${field}`,
    )
  }

  // Rejects missing required keys
  for (const key of Object.keys(validReport)) {
    const copy = { ...validReport }
    delete copy[key]
    assert.equal(
      sanitizeInstallerFeedbackPayload(copy).status,
      400,
      `Should reject missing key: ${key}`,
    )
  }
})

test('installer feedback enforces finite whitelists and ranges', () => {
  // Invalid schema
  assert.equal(sanitizeInstallerFeedbackPayload({ ...validReport, schema: 2 }).status, 400)
  // Invalid tool
  assert.equal(
    sanitizeInstallerFeedbackPayload({ ...validReport, tool: 'asset_quick_read' }).status,
    400,
  )
  // Invalid reportId
  assert.equal(
    sanitizeInstallerFeedbackPayload({ ...validReport, reportId: 'not-a-uuid' }).status,
    400,
  )
  // Invalid installerVersion
  assert.equal(
    sanitizeInstallerFeedbackPayload({ ...validReport, installerVersion: '1.0.0.0' }).status,
    400,
  )
  // Invalid stage
  assert.equal(
    sanitizeInstallerFeedbackPayload({ ...validReport, stage: 'non_existent_stage' }).status,
    400,
  )
  // Invalid code
  assert.equal(
    sanitizeInstallerFeedbackPayload({ ...validReport, code: 'unclassified_raw_error' }).status,
    400,
  )
  // Duration limits
  assert.equal(sanitizeInstallerFeedbackPayload({ ...validReport, durationMs: -1 }).status, 400)
  assert.equal(
    sanitizeInstallerFeedbackPayload({ ...validReport, durationMs: 3600001 }).status,
    400,
  )

  // Attempts validation
  assert.equal(
    sanitizeInstallerFeedbackPayload({ ...validReport, attempts: 'not-array' }).status,
    400,
  )

  // More than 16 attempts
  const tooManyAttempts = Array.from({ length: 17 }, () => ({
    item: 0,
    source: 'github_raw',
    code: 'verified',
    elapsedMs: 100,
  }))
  assert.equal(
    sanitizeInstallerFeedbackPayload({ ...validReport, attempts: tooManyAttempts }).status,
    400,
  )

  // Attempt item out of range (0..2)
  assert.equal(
    sanitizeInstallerFeedbackPayload({
      ...validReport,
      attempts: [{ item: 3, source: 'github_raw', code: 'verified', elapsedMs: 100 }],
    }).status,
    400,
  )

  // Attempt source out of whitelist
  assert.equal(
    sanitizeInstallerFeedbackPayload({
      ...validReport,
      attempts: [{ item: 0, source: 'evil_source', code: 'verified', elapsedMs: 100 }],
    }).status,
    400,
  )

  // Attempt code out of whitelist
  assert.equal(
    sanitizeInstallerFeedbackPayload({
      ...validReport,
      attempts: [{ item: 0, source: 'github_raw', code: 'custom_failure', elapsedMs: 100 }],
    }).status,
    400,
  )

  // Attempt elapsedMs out of range
  assert.equal(
    sanitizeInstallerFeedbackPayload({
      ...validReport,
      attempts: [{ item: 0, source: 'github_raw', code: 'verified', elapsedMs: -5 }],
    }).status,
    400,
  )
})

test('installer receiver persists exact record, enforces 4096 byte cap, KV TTL and stable receipts', async () => {
  const records = new Map()
  const receiver = createScanFeedbackReceiver({
    now: () => Date.parse('2026-10-12T12:00:00Z'),
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

  const first = await send(validReport)
  assert.equal(first.status, 200)
  const firstReceipt = await first.json()
  assert.equal(firstReceipt.status, 'received')
  assert.equal(firstReceipt.reportId, validReport.reportId)
  assert.equal(firstReceipt.receivedAt, '2026-10-12T12:00:00.000Z')

  // Deduplication / idempotence returns identical receipt without duplicate entry
  assert.equal(records.size, 1)
  const second = await send(validReport)
  assert.equal(second.status, 200)
  assert.deepEqual(await second.json(), firstReceipt)
  assert.equal(records.size, 1)

  // Preserves TTL of 30 days
  const stored = [...records.values()][0]
  assert.equal(stored.options.expirationTtl, 30 * 86400)
  const storedParsed = JSON.parse(stored.value)
  assert.equal(storedParsed.tool, 'asset_quick_read_installer')
  assert.equal(storedParsed.code, 'protocol_download_timeout')
  assert.equal(storedParsed.receivedAt, '2026-10-12T12:00:00.000Z')

  // Different payload with different reportId gets its own record
  const differentReport = {
    ...validReport,
    reportId: '00000000-0000-4000-8000-000000000001',
    code: 'payload_hash_mismatch',
  }
  const third = await send(differentReport)
  assert.equal(third.status, 200)
  assert.equal(records.size, 2)
})

test('installer receiver rejects query parameters, cross-origin, and non-POST', async () => {
  const receiver = createScanFeedbackReceiver({
    feedbackStore: { get: async () => null, put: async () => {} },
  })
  const env = {
    SODA_SCAN_FEEDBACK: 'enabled',
    SODA_RELEASE_ID: 'soda-release-current',
    SODA_PUBLIC_ORIGIN: 'https://sodaterminal.com',
  }

  // Query parameter rejected
  const queryRes = await receiver(
    new Request('https://sodaterminal.com/_soda/scan-feedback?extra=1', {
      method: 'POST',
      headers: { origin: 'https://sodaterminal.com', 'content-type': 'application/json' },
      body: JSON.stringify(validReport),
    }),
    env,
  )
  assert.equal(queryRes.status, 400)

  // GET method rejected
  const getRes = await receiver(
    new Request('https://sodaterminal.com/_soda/scan-feedback', {
      method: 'GET',
      headers: { origin: 'https://sodaterminal.com' },
    }),
    env,
  )
  assert.equal(getRes.status, 405)

  // Cross origin rejected
  const crossRes = await receiver(
    new Request('https://sodaterminal.com/_soda/scan-feedback', {
      method: 'POST',
      headers: { origin: 'https://evil.com', 'content-type': 'application/json' },
      body: JSON.stringify(validReport),
    }),
    env,
  )
  assert.equal(crossRes.status, 403)
})
