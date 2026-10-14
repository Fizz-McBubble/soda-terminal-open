/** Small, deterministic L2 regression. Standardization is fitted on training
 * rows only; no agent identities or labels are part of the feature vector. */
export type StrengthTrainingRow = {
  key: string
  group: string
  values: readonly number[]
  target: number
}

export type StrengthRegression = {
  means: number[]
  scales: number[]
  coefficients: number[]
  intercept: number
  alpha: number
  sampleCount: number
  coefficientDirections?: number[]
}

/** Solve the same strictly convex ridge objective inside coefficient bounds.
 * Projection after an unconstrained fit is not equivalent: other coefficients
 * must be refitted when one reaches its bound. No target or fixed bonus is added. */
function solveDirectional(matrix: number[][], rhs: number[], directions: readonly number[]) {
  const coefficients = rhs.map(() => 0)
  for (let iteration = 0; iteration < 10000; iteration++) {
    for (let i = 0; i < rhs.length; i++) {
      const residual =
        rhs[i]! -
        matrix[i]!.reduce((sum, value, j) => sum + (i === j ? 0 : value * coefficients[j]!), 0)
      const next = residual / matrix[i]![i]!
      coefficients[i] =
        directions[i] === 1 ? Math.max(0, next) : directions[i] === -1 ? Math.min(0, next) : next
    }
    // KKT residual proves convergence at both free and active coordinates.
    const residual = Math.max(
      ...coefficients.map((value, i) => {
        const gradient =
          matrix[i]!.reduce((sum, entry, j) => sum + entry * coefficients[j]!, 0) - rhs[i]!
        return value === 0 && directions[i] !== 0
          ? Math.max(0, -directions[i]! * gradient)
          : Math.abs(gradient)
      }),
    )
    if (residual <= 1e-9 * Math.max(1, ...rhs.map(Math.abs))) return coefficients
  }
  throw new Error('Directional strength regression did not converge')
}

function solve(matrix: number[][], rhs: number[]) {
  const size = rhs.length
  const augmented = matrix.map((row, index) => [...row, rhs[index]!])
  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1)
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row
    ;[augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!]
    const divisor = augmented[column]![column]!
    if (Math.abs(divisor) < 1e-12) throw new Error('Singular strength regression')
    for (let index = column; index <= size; index += 1) augmented[column]![index]! /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const multiplier = augmented[row]![column]!
      for (let index = column; index <= size; index += 1)
        augmented[row]![index]! -= multiplier * augmented[column]![index]!
    }
  }
  return augmented.map((row) => row[size]!)
}

export function fitStrengthRegression(
  rows: readonly StrengthTrainingRow[],
  alpha = 10,
  coefficientDirections?: readonly number[],
): StrengthRegression {
  const dimensions = rows[0]?.values.length ?? 0
  if (!rows.length || !dimensions || !Number.isFinite(alpha) || alpha <= 0)
    throw new Error('Strength regression requires finite rows and positive regularization')
  if (
    rows.some(
      (row) =>
        row.values.length !== dimensions ||
        !row.values.every(Number.isFinite) ||
        !Number.isFinite(row.target),
    )
  )
    throw new Error('Invalid strength training row')
  if (
    coefficientDirections &&
    (coefficientDirections.length !== dimensions ||
      coefficientDirections.some((value) => ![-1, 0, 1].includes(value)))
  )
    throw new Error('Invalid strength coefficient directions')
  const means = Array.from(
    { length: dimensions },
    (_, i) => rows.reduce((sum, row) => sum + row.values[i]!, 0) / rows.length,
  )
  const scales = means.map(
    (mean, i) =>
      Math.sqrt(rows.reduce((sum, row) => sum + (row.values[i]! - mean) ** 2, 0) / rows.length) ||
      1,
  )
  const intercept = rows.reduce((sum, row) => sum + row.target, 0) / rows.length
  const matrix = means.map((_, i) => means.map((__, j) => (i === j ? alpha : 0)))
  const rhs = means.map(() => 0)
  for (const row of rows) {
    const values = row.values.map((value, i) => (value - means[i]!) / scales[i]!)
    for (let i = 0; i < dimensions; i += 1) {
      rhs[i]! += values[i]! * (row.target - intercept)
      for (let j = 0; j < dimensions; j += 1) matrix[i]![j]! += values[i]! * values[j]!
    }
  }
  return {
    means,
    scales,
    coefficients: coefficientDirections
      ? solveDirectional(matrix, rhs, coefficientDirections)
      : solve(matrix, rhs),
    intercept,
    alpha,
    sampleCount: rows.length,
    ...(coefficientDirections ? { coefficientDirections: [...coefficientDirections] } : {}),
  }
}

export function predictStrengthRegression(model: StrengthRegression, values: readonly number[]) {
  if (values.length !== model.coefficients.length || !values.every(Number.isFinite))
    throw new Error('Invalid strength inference vector')
  return values.reduce(
    (sum, value, i) =>
      sum + ((value - model.means[i]!) / model.scales[i]!) * model.coefficients[i]!,
    model.intercept,
  )
}

export function validateStrengthRegression(
  rows: readonly StrengthTrainingRow[],
  grouping: 'team' | 'core',
  alpha = 10,
  coefficientDirections?: readonly number[],
) {
  const groupKey = (row: StrengthTrainingRow) => (grouping === 'team' ? row.key : row.group)
  return [...new Set(rows.map(groupKey))].flatMap((group) => {
    const training = rows.filter((row) => groupKey(row) !== group)
    if (!training.length) throw new Error('Strength validation requires independent groups')
    const model = fitStrengthRegression(training, alpha, coefficientDirections)
    return rows
      .filter((row) => groupKey(row) === group)
      .map((row) => ({
        key: row.key,
        group,
        target: row.target,
        predicted: predictStrengthRegression(model, row.values),
        meanBaseline: model.intercept,
        trainingCount: training.length,
      }))
  })
}
