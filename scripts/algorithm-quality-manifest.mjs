// One explicit inventory for private regression, public export and CI.
export const algorithmQualityDirectory = 'tests/algorithm-quality'
export const algorithmQualityLoader = `${algorithmQualityDirectory}/register-ts.mjs`
export const algorithmQualityTests = Object.freeze([
  `${algorithmQualityDirectory}/core.test.mjs`,
  `${algorithmQualityDirectory}/source-goal.test.mjs`,
  `${algorithmQualityDirectory}/team-search-audit.test.mjs`,
  `${algorithmQualityDirectory}/priority-audit.test.mjs`,
])

export function algorithmQualityArguments() {
  return [
    '--experimental-strip-types',
    '--import',
    `./${algorithmQualityLoader}`,
    '--test',
    ...algorithmQualityTests,
  ]
}
