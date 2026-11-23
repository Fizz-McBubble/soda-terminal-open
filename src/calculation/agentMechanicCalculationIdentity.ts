/** Source bytes identify the mechanism; local file locations are only retrieval hints.
 * Keep the original records and all content hashes, provenance and mechanics intact. */
export function agentMechanicCalculationIdentity<
  T extends {
    source: { statsPath: string; formulaPath: string }
    teamActivationContract?: {
      predicate?: { locator?: unknown } | null
      evidence?: { locator?: unknown } | null
    }
  },
>(record: T) {
  const { statsPath, formulaPath, ...source } = record.source
  void statsPath
  void formulaPath
  const activation = record.teamActivationContract
  return {
    ...record,
    source,
    ...(activation
      ? {
          teamActivationContract: {
            ...activation,
            ...(activation.predicate ? { predicate: withoutLocator(activation.predicate) } : {}),
            ...(activation.evidence ? { evidence: withoutLocator(activation.evidence) } : {}),
          },
        }
      : {}),
  }
}

function withoutLocator<T extends { locator?: unknown }>(value: T) {
  const { locator, ...identity } = value
  void locator
  return identity
}
