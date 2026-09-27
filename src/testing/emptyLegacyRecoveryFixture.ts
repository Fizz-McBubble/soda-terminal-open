export type LegacyRecoveryFixture = {
  frozenInput: unknown
  groupsInput: unknown
  stagingInput: unknown
  comparisonInput: unknown
}

/** Release builds never import the maintainer's legacy account recovery samples. */
export async function loadLegacyRecoveryFixture(): Promise<LegacyRecoveryFixture | null> {
  return null
}
