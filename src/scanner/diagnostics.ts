import contract from './scanFeedback.contract.json'
import type { ScannerAssistantSnapshot } from './runtime'

export type ScanDiagnosticReport = {
  schema: 1
  reportId: string
  release: string
  outcome: string
  stage: string
  code: string
  versions: Record<string, string>
  counts: Record<string, number | null>
  durationMs: number | null
  environment: Record<string, number | string>
  evidence: Record<string, number | boolean | string>
}
export type ScannerAttemptDiagnostics = Omit<
  ScanDiagnosticReport,
  'schema' | 'release' | 'outcome'
> & {
  outcome: 'failed' | 'cancelled' | 'completed' | 'unknown'
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isReportId = (value: unknown): value is string =>
  typeof value === 'string' && uuidPattern.test(value)
const integer = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
const choice = (value: unknown, allowed: string[], fallback: string) =>
  typeof value === 'string' && allowed.includes(value) ? value : fallback

/** Reconstruct every field; never retain an untrusted object, error message, path or identifier. */
export function sanitizeScanDiagnostic(value: unknown): ScanDiagnosticReport | null {
  const source = object(value)
  if (source.schema !== 1 || !isReportId(source.reportId)) return null
  const versions: Record<string, string> = {}
  const rawVersions = object(source.versions)
  for (const [key, pattern] of Object.entries(contract.versionPatterns)) {
    const version = rawVersions[key]
    if (typeof version === 'string' && new RegExp(pattern).test(version)) versions[key] = version
  }
  const rawCounts = object(source.counts)
  const counts: Record<string, number | null> = { processed: null, total: null }
  for (const [key, max] of Object.entries(contract.countLimits)) {
    if (integer(rawCounts[key], max)) counts[key] = rawCounts[key]
    else if (rawCounts[key] === null) counts[key] = null
  }
  const environment: Record<string, number | string> = {}
  const rawEnvironment = object(source.environment)
  for (const [key, max] of Object.entries(contract.environmentLimits)) {
    if (integer(rawEnvironment[key], max) && rawEnvironment[key] > 0)
      environment[key] = rawEnvironment[key]
  }
  environment.captureMode = choice(rawEnvironment.captureMode, contract.captureModes, 'unknown')
  environment.browser = choice(rawEnvironment.browser, contract.browsers, 'unknown')
  const evidence: Record<string, number | boolean | string> = {}
  const rawEvidence = object(source.evidence)
  for (const [key, max] of Object.entries(contract.evidenceLimits)) {
    if (integer(rawEvidence[key], max)) evidence[key] = rawEvidence[key]
  }
  for (const key of contract.evidenceBooleans) {
    if (typeof rawEvidence[key] === 'boolean') evidence[key] = rawEvidence[key]
  }
  if (
    typeof rawEvidence.targetVerificationKind === 'string' &&
    contract.targetVerificationKinds.includes(rawEvidence.targetVerificationKind)
  )
    evidence.targetVerificationKind = rawEvidence.targetVerificationKind
  if (
    typeof rawEvidence.firstMissingRoi === 'string' &&
    contract.missingRois.includes(rawEvidence.firstMissingRoi)
  )
    evidence.firstMissingRoi = rawEvidence.firstMissingRoi
  const report: ScanDiagnosticReport = {
    schema: 1,
    reportId: source.reportId,
    release:
      typeof source.release === 'string' && new RegExp(contract.releasePattern).test(source.release)
        ? source.release
        : 'local-development',
    outcome: choice(source.outcome, contract.outcomes, 'unknown'),
    stage: choice(source.stage, contract.stages, 'unknown'),
    code: choice(source.code, contract.codes, 'unknown'),
    versions,
    counts,
    durationMs: integer(source.durationMs, contract.durationMaxMs) ? source.durationMs : null,
    environment,
    evidence,
  }
  return new TextEncoder().encode(JSON.stringify(report)).length <= contract.maxBytes
    ? report
    : null
}

export function browserDiagnostic(userAgent: string) {
  for (const [browser, pattern] of [
    ['edge', /Edg\/(\d+)/],
    ['chrome', /Chrome\/(\d+)/],
    ['firefox', /Firefox\/(\d+)/],
    ['safari', /Version\/(\d+).*Safari/],
  ] as const) {
    const match = userAgent.match(pattern)
    if (match) return { browser, browserMajor: Number(match[1]) }
  }
  return { browser: 'unknown' }
}
const stages: Record<string, string> = {
  helper_unavailable: 'connection',
  helper_incompatible: 'connection',
  helper_pairing_denied: 'connection',
  permission_denied: 'permission',
  elevation_cancelled: 'permission',
  game_process_not_found: 'preflight',
  panel_capture_timeout: 'capture',
  duplicate_guard: 'ocr',
  scan_navigation_failed: 'scroll',
  visual_preflight_failed: 'preflight',
  ocr_worker_failed: 'ocr',
  direct_fork_result_missing: 'result',
  direct_fork_partial: 'result',
  scan_result_timeout: 'result',
  scan_result_read_failed: 'result',
  scan_import_handoff_failed: 'import',
  scan_import_failed: 'import',
  scan_file_invalid: 'import',
}
export function diagnosticFromSnapshot(
  snapshot: ScannerAssistantSnapshot,
  attemptId: string,
  issueCode?: string | null,
): ScanDiagnosticReport {
  const raw = object((snapshot as ScannerAssistantSnapshot & { diagnostics?: unknown }).diagnostics)
  const code = issueCode ?? raw.code ?? snapshot.error?.diagnosticCode
  const connectionIssue = Boolean(issueCode && stages[issueCode] === 'connection')
  return sanitizeScanDiagnostic({
    ...raw,
    schema: 1,
    reportId: !issueCode && isReportId(raw.reportId) ? raw.reportId : attemptId,
    release: import.meta.env.VITE_SODA_RELEASE_ID || 'local-development',
    outcome: connectionIssue
      ? 'failed'
      : (raw.outcome ?? (snapshot.state === 'completed' ? 'completed' : 'failed')),
    stage: (issueCode ? stages[issueCode] : (raw.stage ?? stages[String(code)])) ?? 'unknown',
    code,
    versions: raw.versions ?? {},
    counts: connectionIssue
      ? {}
      : (raw.counts ?? {
          processed: snapshot.progress?.processed ?? null,
          total: snapshot.progress?.total ?? null,
        }),
    durationMs: connectionIssue ? null : (raw.durationMs ?? null),
    environment: {
      ...snapshot.prepare?.geometry?.client,
      ...object(raw.environment),
      ...browserDiagnostic(navigator.userAgent),
    },
    evidence: connectionIssue ? {} : raw.evidence,
  })!
}
export function diagnosticJson(report: ScanDiagnosticReport) {
  const safe = sanitizeScanDiagnostic(report)
  if (!safe) throw new Error('invalid-diagnostic')
  return JSON.stringify(safe, null, 2)
}
