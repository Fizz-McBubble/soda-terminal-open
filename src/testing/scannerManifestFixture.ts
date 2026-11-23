type DistributionModule = typeof import('../scanner/distribution')
type ReleaseState = DistributionModule['scannerDistributionManifest']['runtime']['releaseState']

/** Test-local publication state; absent overrides retain the actual candidate. */
export function scannerDistributionFixture(
  actual: DistributionModule,
  readState: () => ReleaseState | null,
): DistributionModule {
  return {
    ...actual,
    scannerDistributionManifest: {
      ...actual.scannerDistributionManifest,
      runtime: {
        ...actual.scannerDistributionManifest.runtime,
        get releaseState() {
          return readState() ?? actual.scannerDistributionManifest.runtime.releaseState
        },
      },
    },
  }
}
