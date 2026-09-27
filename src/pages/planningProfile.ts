import { createContext, useContext } from 'react'
import { getPlanningProfile } from '@soda/planning-profile'
import type { PlanningProfileResolver } from './planningProfileTypes'

export type { PlanningProfile, PlanningProfileResolver } from './planningProfileTypes'
export { getPlanningProfile }

export const PlanningProfileContext = createContext<PlanningProfileResolver>(getPlanningProfile)

export function usePlanningProfile(agentId: string) {
  return useContext(PlanningProfileContext)(agentId)
}
