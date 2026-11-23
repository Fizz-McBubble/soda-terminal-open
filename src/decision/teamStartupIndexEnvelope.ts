const startupContract = 'soda-team-startup-index/v1'

export function readTeamStartupIndex(input: unknown) {
  const value = input as Record<string, unknown>
  if (value?.storageContract !== startupContract)
    return { artifact: input, fullHash: null, keys: null, indexSize: null }
  const { artifact, fullHash, keys, indexSize } = value
  if (
    typeof fullHash !== 'string' ||
    !/^fnv1a-[a-f0-9]+$/u.test(fullHash) ||
    !Array.isArray(keys) ||
    keys.length === 0 ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => typeof key !== 'string') ||
    typeof indexSize !== 'number' ||
    !Number.isSafeInteger(indexSize) ||
    indexSize < keys.length ||
    !artifact ||
    typeof artifact !== 'object'
  )
    throw new Error('Invalid BOX startup index scope.')
  return { artifact, fullHash, keys: new Set<string>(keys), indexSize }
}
