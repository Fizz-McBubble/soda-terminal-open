import type { RosterAgent } from '../assault/types'
import type { CandidatePanelInput } from './candidatePanelObjective'
import {
  candidatePanelInputForSchemeAgent,
  type CandidateSchemeAgentPlanningState,
} from './optimizeAccountBuildsPanelInput'

/** Shared by live solving and saved-plan replay; selected scheme engines are not account ownership. */
export function candidatePanelInputsForScheme(
  agents: readonly RosterAgent[],
  memberIds: readonly string[],
  engines:
    | readonly {
        agentId: string
        engineId: string
        refinement: number
        level?: number
        ascension?: number | null
      }[]
    | undefined,
  agentStateById?: Readonly<Record<string, CandidateSchemeAgentPlanningState>>,
): Record<string, CandidatePanelInput> | undefined {
  if (
    !engines ||
    memberIds.length !== 3 ||
    new Set(memberIds).size !== 3 ||
    engines.length !== 3 ||
    new Set(engines.map((engine) => engine.agentId)).size !== 3 ||
    !memberIds.every((id) => engines.some((engine) => engine.agentId === id))
  )
    return undefined
  const inputs = Object.fromEntries(
    memberIds.flatMap((agentId) => {
      const agent = agents.find((item) => item.agentId === agentId)
      const engine = engines.find((item) => item.agentId === agentId)
      const input =
        agent && engine
          ? candidatePanelInputForSchemeAgent(agent, engine, agentStateById?.[agentId])
          : undefined
      return input ? [[agentId, input]] : []
    }),
  )
  return Object.keys(inputs).length ? inputs : undefined
}
