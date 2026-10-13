import type { ReviewedPotentialDefinition } from './reviewedPotentialDefinitionContract'

/** Runtime source identity excludes only local evidence locations. Original
 * records retain their locators; content hashes, versions and mechanics remain
 * identity inputs in both the private and published source projections. */
export function reviewedPotentialCalculationIdentity(definition: ReviewedPotentialDefinition) {
  const { upstreamRawPath: _upstreamRawPath, supplementarySources, ...source } = definition.source
  void _upstreamRawPath
  return {
    ...definition,
    source: {
      ...source,
      ...(supplementarySources === undefined
        ? {}
        : {
            supplementarySources: supplementarySources.map(({ evidencePath, ...identity }) => {
              void evidencePath
              return identity
            }),
          }),
    },
  }
}
