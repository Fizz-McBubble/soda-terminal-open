// Synthetic in-memory import state; no account or historical fixture is loaded.
export function createSyntheticFormalImportCurrent(
  overrides: Record<string, unknown> = {},
  displayName = '测试账户',
) {
  return {
    account: { id: 'account-current', displayName },
    binding: {
      accountId: 'account-current',
      displayName,
      baselineDiscCount: 0,
      operation: 'replace_drive_discs',
    },
    discs: 0,
    batch: {
      id: 'formal-paddle',
      total: 343,
      recognitionVersion: 'paddle-pp-ocrv6-small',
      reviewState: {
        revision: 4,
        preflight: 'complete',
        preflightRevision: 4,
        armedRevision: null,
      },
    },
    items: Array.from({ length: 343 }, (_, index) => ({ sourceIdentity: `source-${index}` })),
    summary: { total: 343, ready: 343, needsReview: 0, invalid: 0, duplicate: 0, lockUnknown: 0 },
    ...overrides,
  }
}
