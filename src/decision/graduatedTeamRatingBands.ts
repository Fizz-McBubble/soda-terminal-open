/** Display vocabulary only. Numerical calibration belongs to the offline producer. */
export const graduatedTeamRatingBands = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C'] as const
export type GraduatedTeamRatingBand = (typeof graduatedTeamRatingBands)[number]
export const graduatedTeamRatingBandOrder: Record<GraduatedTeamRatingBand, number> = {
  'S+': 0, S: 1, 'A+': 2, A: 3, 'B+': 4, B: 5, C: 6,
}
