import type { GenericReferenceInterval } from './teamReferenceInterval'
import type { GraduatedTeamRatingBand } from './graduatedTeamRatingBands'

export type GenericTeamOrder = {
  contract: 'soda-generic-team-ranking/v1'
  status: 'recommended' | 'exploration' | 'unsupported'
  band: GraduatedTeamRatingBand | null
  confidence: 'high' | 'medium' | 'low' | null
  sourceAuthority: string | null
  displayOrder: number
  referenceInterval?: GenericReferenceInterval | null
  orderScope?: 'reference_display'
}
