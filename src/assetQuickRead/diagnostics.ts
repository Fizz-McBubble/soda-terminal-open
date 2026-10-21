import { z } from 'zod'
import contract from '../scanner/scanFeedback.contract.json'
import type { AssetBridgeJob } from './bridgeClient'
import { browserDiagnostic } from '../scanner/diagnostics'
import {
  AssetQuickReadUnavailableError,
  type AssetQuickReadUnavailableDiagnostic,
} from './launcher'
import { AssetQuickReadImportError } from './importErrors'

const rules = contract.assetQuickRead
const listed = (values: string[]) => z.string().refine((value) => values.includes(value))
const count = z.number().int().min(0).max(100000)
const schema = z
  .object({
    schema: z.literal(1),
    tool: z.literal('asset_quick_read'),
    reportId: z.string().uuid(),
    release: z.string().regex(new RegExp(contract.releasePattern)),
    outcome: listed(contract.outcomes),
    stage: listed(rules.stages),
    code: listed(rules.codes),
    versions: z
      .object({
        bridge: z.string().regex(new RegExp(rules.versionPatterns.bridge)).optional(),
        protocol: z.literal('1').optional(),
      })
      .strict(),
    counts: z
      .object({
        processed: count.nullable(),
        total: count.nullable(),
        agents: count.max(10000).optional(),
        discs: count.optional(),
        engines: count.optional(),
      })
      .strict(),
    durationMs: z.number().int().min(0).max(contract.durationMaxMs).nullable(),
    environment: z
      .object({
        browser: listed(rules.browsers).optional(),
        browserMajor: z.number().int().positive().max(1000).optional(),
      })
      .strict(),
    evidence: z
      .object({
        remainingSeconds: z.number().int().min(0).max(180).optional(),
        candidateAvailable: z.boolean().optional(),
        candidateStatus: listed(rules.evidenceEnums.candidateStatus).optional(),
        candidateIssueCount: z
          .number()
          .int()
          .min(0)
          .max(rules.evidenceLimits.candidateIssueCount)
          .optional(),
        candidateStatusReported: z.boolean().optional(),
        protocolLaunchAttempted: z.boolean().optional(),
        healthProbeAttempts: z
          .number()
          .int()
          .min(0)
          .max(rules.evidenceLimits.healthProbeAttempts)
          .optional(),
        uiState: listed(rules.evidenceEnums.uiState).optional(),
        lastAction: listed(rules.evidenceEnums.lastAction).optional(),
        connectionStage: listed(rules.evidenceEnums.connectionStage).optional(),
        captureOpenReason: listed(rules.evidenceEnums.captureOpenReason).optional(),
        jobState: listed(rules.evidenceEnums.jobState).optional(),
        jobPhase: listed(rules.evidenceEnums.jobPhase).optional(),
        nativeErrorCode: z
          .number()
          .int()
          .min(0)
          .max(rules.evidenceLimits.nativeErrorCode)
          .optional(),
        childExitCode: z.number().int().min(0).max(rules.evidenceLimits.childExitCode).optional(),
      })
      .strict(),
  })
  .strict()
export type AssetDiagnosticReport = z.infer<typeof schema>
export type AssetDiagnosticStage =
  | 'connection'
  | 'permission'
  | 'startup'
  | 'waiting'
  | 'result'
  | 'import'
export type AssetDiagnosticAction =
  | 'connect'
  | 'start'
  | 'inspect_file'
  | 'import'
  | 'restore'
  | 'status_feedback'
export type AssetDiagnosticUiState =
  | 'idle'
  | 'connecting'
  | 'starting'
  | 'capturing'
  | 'received'
  | 'timed_out'
  | 'stopped'
  | 'error'
  | 'completed'
export class AssetQuickReadRequestError extends Error {
  readonly diagnosticCode: string
  readonly diagnostic?: AssetQuickReadUnavailableDiagnostic
  constructor(
    code: string,
    message: string,
    options?: ErrorOptions & { diagnostic?: AssetQuickReadUnavailableDiagnostic },
  ) {
    super(message, { cause: options?.cause })
    this.diagnosticCode = rules.codes.includes(code) ? code : 'unknown'
    this.diagnostic = options?.diagnostic
  }
}
export function sanitizeAssetDiagnostic(value: unknown): AssetDiagnosticReport | null {
  const parsed = schema.safeParse(value)
  if (
    !parsed.success ||
    new TextEncoder().encode(JSON.stringify(parsed.data)).length > contract.maxBytes
  )
    return null
  return parsed.data
}
export function assetFailureDiagnostic(
  stage: AssetDiagnosticStage,
  error?: unknown,
  job?: AssetBridgeJob | null,
  version?: string,
  now = Date.now(),
  lastAction?: AssetDiagnosticAction,
  uiState?: AssetDiagnosticUiState,
): AssetDiagnosticReport {
  // Import and connection failures do not describe a retained capture task.
  const scopedJob = stage === 'import' || stage === 'connection' ? null : job
  const candidate =
    error instanceof AssetQuickReadRequestError || error instanceof AssetQuickReadImportError
      ? error.diagnosticCode
      : error instanceof AssetQuickReadUnavailableError
        ? 'bridge_unavailable'
        : scopedJob?.code
  const fallback = {
    connection: 'bridge_unavailable',
    permission: 'elevation_denied',
    startup: 'capture_failed',
    waiting: 'wait_timeout',
    result: 'result_read_failed',
    import: 'import_failed',
  }
  const malformedResult =
    stage === 'result' &&
    (error instanceof SyntaxError || (error instanceof Error && error.name.startsWith('Zod')))
  const code =
    candidate && rules.codes.includes(candidate)
      ? candidate
      : malformedResult
        ? 'result_invalid'
        : fallback[stage]
  const actualStage = ['elevation_denied', 'uac_declined', 'origin_not_allowed'].includes(code)
    ? 'permission'
    : code.startsWith('candidate_') || code === 'progress_invalid'
      ? 'result'
      : stage
  const connectionEvidence =
    error instanceof AssetQuickReadUnavailableError || error instanceof AssetQuickReadRequestError
      ? error.diagnostic
      : undefined
  const captureOpenReason =
    code === 'capture_open_failed' && typeof scopedJob?.diagnostics?.nativeErrorCode === 'number'
      ? ((
          {
            2: 'file_not_found',
            5: 'access_denied',
            32: 'sharing_violation',
            87: 'invalid_parameter',
            1450: 'system_resources_unavailable',
          } as const
        )[scopedJob.diagnostics.nativeErrorCode as 2 | 5 | 32 | 87 | 1450] ?? 'other')
      : undefined
  const jobEvidence = scopedJob
    ? {
        candidateAvailable: scopedJob.candidateAvailable,
        jobState: scopedJob.state,
        ...(rules.evidenceEnums.jobPhase.includes(scopedJob.phase)
          ? { jobPhase: scopedJob.phase }
          : {}),
        ...(code === 'candidate_status_invalid'
          ? { candidateStatusReported: Boolean(scopedJob.diagnostics?.candidateStatus) }
          : {}),
        ...(captureOpenReason ? { captureOpenReason } : {}),
        ...(scopedJob.diagnostics?.candidateStatus &&
        rules.evidenceEnums.candidateStatus.includes(scopedJob.diagnostics.candidateStatus)
          ? { candidateStatus: scopedJob.diagnostics.candidateStatus }
          : {}),
        ...Object.fromEntries(
          ['nativeErrorCode', 'childExitCode', 'candidateIssueCount'].flatMap((key) => {
            const value =
              scopedJob.diagnostics?.[key as keyof NonNullable<AssetBridgeJob['diagnostics']>]
            const max = rules.evidenceLimits[key as keyof typeof rules.evidenceLimits]
            return typeof value === 'number' &&
              Number.isInteger(value) &&
              value >= 0 &&
              value <= max
              ? [[key, value]]
              : []
          }),
        ),
        ...(Number.isInteger(scopedJob.remainingSeconds) && scopedJob.remainingSeconds! <= 180
          ? { remainingSeconds: scopedJob.remainingSeconds }
          : {}),
      }
    : {}
  const evidence = {
    ...jobEvidence,
    ...connectionEvidence,
    ...(lastAction ? { lastAction } : {}),
    ...(uiState ? { uiState } : {}),
  }
  return sanitizeAssetDiagnostic({
    schema: 1,
    tool: 'asset_quick_read',
    reportId: crypto.randomUUID(),
    release: import.meta.env.VITE_SODA_RELEASE_ID || 'local-development',
    outcome: 'failed',
    stage: actualStage,
    code,
    versions:
      version && new RegExp(rules.versionPatterns.bridge).test(version)
        ? { bridge: version, protocol: '1' }
        : {},
    counts: {
      processed: null,
      total: null,
      ...(scopedJob?.counts &&
      (scopedJob.candidateAvailable || Object.values(scopedJob.counts).some((value) => value > 0))
        ? Object.fromEntries(
            Object.entries(scopedJob.counts).filter(
              ([key, value]) =>
                Object.hasOwn(rules.countLimits, key) &&
                Number.isInteger(value) &&
                value >= 0 &&
                value <= rules.countLimits[key as keyof typeof rules.countLimits],
            ),
          )
        : {}),
    },
    durationMs:
      scopedJob &&
      Number.isFinite(Date.parse(scopedJob.startedAt)) &&
      now >= Date.parse(scopedJob.startedAt)
        ? Math.min(contract.durationMaxMs, Math.round(now - Date.parse(scopedJob.startedAt)))
        : null,
    environment: browserDiagnostic(navigator.userAgent),
    evidence,
  })!
}

export function assetQuickReadStatusDiagnostic(
  state: AssetDiagnosticUiState,
  job?: AssetBridgeJob | null,
  version?: string,
  now = Date.now(),
): AssetDiagnosticReport {
  const stage =
    state === 'idle' || state === 'connecting'
      ? 'connection'
      : state === 'starting'
        ? 'startup'
        : state === 'capturing' || state === 'timed_out' || state === 'stopped'
          ? 'waiting'
          : 'result'
  return {
    ...assetFailureDiagnostic(stage, undefined, job, version, now, 'status_feedback', state),
    outcome: state === 'completed' ? 'completed' : 'unknown',
    code: 'status_only',
  }
}
