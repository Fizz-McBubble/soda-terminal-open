type ScannerDistribution = typeof import('./distribution')

export function withHelperMinimumFixture(
  actual: ScannerDistribution,
  fixture: { version: string | null },
): ScannerDistribution {
  const manifest = actual.scannerDistributionManifest
  const helper = { ...manifest.helper }
  Object.defineProperty(helper, 'version', {
    get: () => fixture.version ?? manifest.helper.version,
  })
  return {
    ...actual,
    scannerDistributionManifest: { ...manifest, helper },
  }
}
