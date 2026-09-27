/*
 * Derived verbatim from frzyc/genshin-optimizer:
 * libs/pando/engine/src/node/formula.ts
 * Commit: 9617fb58334cfe84e26252041fb9510c34057f62
 * Copyright (c) 2020-present frzyc
 * License: MIT (see NOTICE.md in this directory)
 *
 * This is the dependency-free arithmetic executor used by the ZZZ formula
 * slice. It intentionally excludes the upstream tag graph and worker runtime.
 */

type Arithmetic = 'sum' | 'prod' | 'min' | 'max' | 'sumfrac' | 'unique'

/** Original upstream Pando arithmetic implementation. */
export const arithmetic: Record<Arithmetic, (x: number[]) => number> = {
  sum: (x) => x.reduce((a, b) => a + b, 0),
  prod: (x) => x.reduce((a, b) => a * b, 1),
  min: (x) => Math.min(...x),
  max: (x) => Math.max(...x),
  sumfrac: ([x, c]) => x! / (x! + c!),
  unique: ([x]) => x!,
}
