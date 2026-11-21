/** Level-60 Bangboo active and chain skills grow with additional ability stars. */
export function bangbooBaseSkillLevelForStars(stars: number): number | null {
  return Number.isInteger(stars) && stars >= 1 && stars <= 5 ? 5 + stars : null
}
