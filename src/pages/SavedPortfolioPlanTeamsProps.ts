import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'

/**
 * Shared inputs for the saved multi-team plan body. The desktop build also renders the frozen
 * 18-disc evidence; the public build renders the same saved facts without a local solver.
 * A saved portfolio is always read-only: neither build re-solves or rewrites the plan here.
 */
export type SavedPortfolioPlanTeamsProps = {
  plan: AccountPlanningDraft
  warehouse: CoreWarehouse
  allocation: readonly import('../optimizer/optimizeAccountBuilds').AccountLoadout[]
  discRecommendations?: readonly import('../decision/buildIntent').BuildIntentRecommendation[]
}
