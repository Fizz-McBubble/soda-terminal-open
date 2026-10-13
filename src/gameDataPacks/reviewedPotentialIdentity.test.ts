import { describe, expect, it } from 'vitest'
import { reviewedPotentialDefinitions } from './reviewedPotentialDefinitions'
import { reviewedPotentialCalculationIdentity } from './reviewedPotentialIdentity'
import { stableContentHash } from './types'

const definition = reviewedPotentialDefinitions[0]!
const fingerprint = (value: typeof definition) =>
  stableContentHash(reviewedPotentialCalculationIdentity(value))

describe('reviewed potential calculation identity', () => {
  it('excludes precisely the two local locator fields without altering source records', () => {
    const original = structuredClone(definition)
    const publicProjection = structuredClone(definition)
    publicProjection.source.upstreamRawPath = 'soda-source-ref:public/Burnice.json'
    for (const source of publicProjection.source.supplementarySources ?? [])
      source.evidencePath = 'soda-source-ref:public-evidence'
    expect(fingerprint(publicProjection)).toBe(fingerprint(definition))
    expect(definition).toEqual(original)
    const identity = reviewedPotentialCalculationIdentity(definition)
    expect(identity.source).not.toHaveProperty('upstreamRawPath')
    expect(identity.source.supplementarySources?.[0]).not.toHaveProperty('evidencePath')
    expect(identity.effects).toEqual(definition.effects)
  })

  it('invalidates every other source and mechanic leaf, including SHA, version, formula and condition', () => {
    const baseline = fingerprint(definition)
    const paths: string[][] = []
    function leaves(value: unknown, path: string[] = []) {
      if (value !== null && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) leaves(entry, [...path, key])
      } else if (!['upstreamRawPath', 'evidencePath'].includes(path.at(-1)!)) paths.push(path)
    }
    leaves(definition)
    expect(paths).toContainEqual(['source', 'upstreamRawSha256'])
    expect(paths).toContainEqual(['source', 'contentHash'])
    expect(paths).toContainEqual(['source', 'sourceVersion'])
    expect(paths).toContainEqual(['effects', '0', 'activationRequirement'])
    expect(paths.some((path) => path.includes('formulaBinding'))).toBe(true)
    expect(
      paths.some((path) => path.includes('supplementarySources') && path.includes('contentHash')),
    ).toBe(true)
    for (const path of paths) {
      const changed = structuredClone(definition)
      let parent = changed as unknown as Record<string, unknown>
      for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>
      const key = path.at(-1)!
      const previous = parent[key]
      parent[key] = typeof previous === 'number' ? previous + 1 : `${previous}:changed`
      expect(fingerprint(changed), path.join('.')).not.toBe(baseline)
    }
  })
})
