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
    coefficients: solve(matrix, rhs),
    intercept,
    alpha,
    sampleCount: rows.length,
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
) {
  const groupKey = (row: StrengthTrainingRow) => (grouping === 'team' ? row.key : row.group)
  return [...new Set(rows.map(groupKey))].flatMap((group) => {
    const training = rows.filter((row) => groupKey(row) !== group)
    if (!training.length) throw new Error('Strength validation requires independent groups')
    const model = fitStrengthRegression(training, alpha)
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
