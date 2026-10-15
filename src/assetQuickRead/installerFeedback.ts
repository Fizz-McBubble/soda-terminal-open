import { z } from 'zod'
import contract from '../scanner/scanFeedback.contract.json'
import { withFeedbackTimeout } from '../scanner/feedbackRequest'

const installerRules = contract.assetQuickReadInstaller
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const attemptSchema = z
  .object({
    item: z.number().int().min(0).max(installerRules.maxItemIndex),
    source: z.enum(['github_raw', 'github_contents', 'verified_local', 'github_archive']),
    code: z
      .string()
      .refine((val) => (installerRules.attemptCodes as readonly string[]).includes(val)),
    elapsedMs: z.number().int().min(0).max(installerRules.durationMaxMs),
  })
  .strict()

const installerFeedbackSchema = z
  .object({
    schema: z.literal(1),
    tool: z.enum(['asset_quick_read_installer', 'screen_scanner_installer']),
    reportId: z.string().regex(UUID_REGEX),
    installerVersion: z.string(),
    stage: z.string(),
    code: z.string(),
    durationMs: z.number().int().min(0).max(installerRules.durationMaxMs),
    attempts: z.array(attemptSchema).max(installerRules.maxAttempts),
  })
  .strict()
  .superRefine((report, context) => {
    const rules =
      report.tool === 'screen_scanner_installer' ? contract.screenScannerInstaller : installerRules
    for (const [field, valid] of [
      ['installerVersion', new RegExp(rules.versionPattern).test(report.installerVersion)],
      ['stage', (rules.stages as readonly string[]).includes(report.stage)],
      ['code', (rules.codes as readonly string[]).includes(report.code)],
      ['attempts', report.attempts.length <= rules.maxAttempts],
    ] as const) {
      if (!valid)
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Invalid installer diagnostic field',
        })
    }
  })

export type InstallerAttempt = z.infer<typeof attemptSchema>
export type InstallerFeedbackReport = z.infer<typeof installerFeedbackSchema>

export interface InstallerFeedbackReceipt {
  report: InstallerFeedbackReport
  receivedAt: string
}

export const installerReceiptStorageKey = 'soda.asset-quick-read.installer.last-feedback-receipt.v1'

export function sanitizeInstallerFeedback(raw: unknown): InstallerFeedbackReport | null {
  const result = installerFeedbackSchema.safeParse(raw)
  if (!result.success) return null
  const json = JSON.stringify(result.data)
  if (new TextEncoder().encode(json).length > contract.maxBytes) return null
  return result.data
}

/**
 * Synchronously consumes and strips the URI fragment hash before any network or async task.
 * Extraneous, invalid, or sensitive keys cause strict rejection and return null.
 * Never outputs or retains the raw fragment.
 */
export function consumeInstallerFeedbackFragment(
  location: { hash: string; pathname: string } = window.location,
  history: {
    replaceState: (data: unknown, unused: string, url?: string | URL | null) => void
  } = window.history,
): InstallerFeedbackReport | null {
  const hash = location.hash
  if (!hash || hash === '#') return null

  // Immediately strip the hash from browser history / URL bar before any async work
  try {
    history.replaceState(null, '', location.pathname)
  } catch {
    return null
  }

  const rawString = hash.startsWith('#') ? hash.slice(1) : hash
  if (rawString.length > contract.maxBytes * 3) return null
  let parsed: unknown
  try {
    const decoded = decodeURIComponent(rawString)
    parsed = JSON.parse(decoded)
  } catch {
    // If decoding failed, do not retain or log raw fragment
    return null
  }

  return sanitizeInstallerFeedback(parsed)
}

/** Restore only the last validated, acknowledged report; never submit on read. */
export function readLastInstallerReceipt(
  storage: Storage = localStorage,
): InstallerFeedbackReceipt | null {
  try {
    const raw = storage.getItem(installerReceiptStorageKey)
    if (!raw || new TextEncoder().encode(raw).length > contract.maxBytes + 128) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (Object.keys(parsed).length !== 2) return null
    const safeReport = sanitizeInstallerFeedback(parsed.report)
    if (!safeReport) return null
    if (
      typeof parsed.receivedAt !== 'string' ||
      parsed.receivedAt.length > 32 ||
      !Number.isFinite(Date.parse(parsed.receivedAt))
    ) {
      return null
    }
    return { report: safeReport, receivedAt: parsed.receivedAt }
  } catch {
    return null
  }
}

export function readInstallerReceipt(
  report: InstallerFeedbackReport,
  storage: Storage = localStorage,
): InstallerFeedbackReceipt | null {
  const receipt = readLastInstallerReceipt(storage)
  return receipt && JSON.stringify(receipt.report) === JSON.stringify(report) ? receipt : null
}

export function saveInstallerReceipt(
  receipt: InstallerFeedbackReceipt,
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(installerReceiptStorageKey, JSON.stringify(receipt))
  } catch {
    /* Retain in component memory */
  }
}

/**
 * Explicit user-click submission of installer failure feedback.
 * Strictly uses credentials: 'omit' and the existing timeout utility.
 */
export async function submitInstallerFeedback(
  report: InstallerFeedbackReport,
  fetcher: typeof fetch = fetch,
  timeoutMs = 12000,
): Promise<InstallerFeedbackReceipt> {
  const safe = sanitizeInstallerFeedback(report)
  if (!safe) throw new Error('invalid-installer-report')

  return withFeedbackTimeout(timeoutMs, async (signal) => {
    const response = await fetcher(contract.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safe),
      credentials: 'omit',
      signal,
    })

    if (!response.ok) {
      throw new Error(response.status === 404 ? 'unavailable' : 'retry')
    }

    const ack = (await response.json()) as Record<string, unknown>
    if (
      signal.aborted ||
      ack.status !== 'received' ||
      ack.reportId !== safe.reportId ||
      typeof ack.receivedAt !== 'string' ||
      ack.receivedAt.length > 32 ||
      !Number.isFinite(Date.parse(ack.receivedAt))
    ) {
      throw new Error('invalid-receipt')
    }

    const receipt: InstallerFeedbackReceipt = {
      report: safe,
      receivedAt: ack.receivedAt,
    }
    saveInstallerReceipt(receipt)
    return receipt
  })
}
