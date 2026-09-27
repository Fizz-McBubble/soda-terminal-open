/*
 * Derived verbatim from frzyc/genshin-optimizer:
 * libs/zzz/formula/src/formulaMeta.ts
 * Commit: 9617fb58334cfe84e26252041fb9510c34057f62
 * Copyright (c) 2020-present frzyc
 * License: MIT (see NOTICE.md in this directory)
 *
 * This preserves the upstream ZZZ formula layer's damage-dimension gate for
 * a deliberately narrow one-action adapter. It is not the full generated
 * character-sheet data graph.
 */

export const abilityDims = ['standardDmg', 'sheerDmg', 'dazeBuildup', 'anomBuildup'] as const

export type AbilityDim = (typeof abilityDims)[number]

export const dmgAbilityDims = ['standardDmg', 'sheerDmg'] as const

export type DmgAbilityDim = (typeof dmgAbilityDims)[number]

/** Original upstream ZZZ formula metadata guard. */
export function isDmgAbilityDim(q: string | null | undefined): q is DmgAbilityDim {
  return q === 'standardDmg' || q === 'sheerDmg'
}
