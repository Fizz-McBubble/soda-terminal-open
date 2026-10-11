import { z } from 'zod'
import contract from '../scanner/scanFeedback.contract.json'
import type { AssetBridgeJob } from './bridgeClient'
import { browserDiagnostic } from '../scanner/diagnostics'

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
        jobState: listed(rules.evidenceEnums.jobState).optional(),
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
export class AssetQuickReadRequestError extends Error {
  readonly diagnosticCode: string
  constructor(code: string, message: string) {
    super(message)
    this.diagnosticCode = rules.codes.includes(code) ? code : 'unknown'
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
): AssetDiagnosticReport {
  const candidate = error instanceof AssetQuickReadRequestError ? error.diagnosticCode : job?.code
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
      ...(job?.counts
        ? Object.fromEntries(
            Object.entries(job.counts).filter(
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
      job && Number.isFinite(Date.parse(job.startedAt)) && now >= Date.parse(job.startedAt)
        ? Math.min(contract.durationMaxMs, Math.round(now - Date.parse(job.startedAt)))
        : null,
    environment: browserDiagnostic(navigator.userAgent),
    evidence: job
      ? {
          candidateAvailable: job.candidateAvailable,
          jobState: job.state,
          ...(Number.isInteger(job.remainingSeconds) && job.remainingSeconds! <= 180
            ? { remainingSeconds: job.remainingSeconds }
            : {}),
        }
      : {},
  })!
}
