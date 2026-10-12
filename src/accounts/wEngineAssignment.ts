import type { AccountRoster } from '../assault/types'
import { updateAccountRoster } from './repository'
import { database, type SodaDatabase } from '../db/databaseCore'
import { normalizeObservedAgentFacts } from './observedAgentFacts'

export type WEngineCatalogEntry = {
  stableId: string
  playerName: string
  specialty: string | null
  rarity: string | null
}

export type AgentWEngineDraft = {
  /** Legacy form field; new saves always clear copy identity. */
  wEngineCopyId: string | null
  wEngineCatalogId?: string | null
  wEngineLevel?: number | null
  wEngineLevelManuallySet?: boolean
  wEngineAscension?: number | null
  wEngineRefinement?: number | null
  wEngineRefinementManuallySet?: boolean
}

export function agentWEngineRevision(roster: AccountRoster, agentId: string) {
  const source = roster.agents.find((agent) => agent.agentId === agentId)
  return JSON.stringify({ source })
}

export function applyAgentWEngineAssignment({
  roster,
  agentId,
  draft,
  agentPatch,
  agents,
  wengines,
}: {
  roster: AccountRoster
  agentId: string
  draft: AgentWEngineDraft
  agentPatch?: Partial<AccountRoster['agents'][number]>
  agents: readonly WEngineCatalogEntry[]
  wengines: readonly WEngineCatalogEntry[]
}): AccountRoster {
  const targetAgent = agents.find((agent) => agent.stableId === agentId)
  if (!targetAgent) throw new Error('当前代理人已不存在，请刷新后重新确认。')
  const selectedEngine = draft.wEngineCatalogId
    ? wengines.find((engine) => engine.stableId === draft.wEngineCatalogId)
    : null
  if (
    draft.wEngineCatalogId &&
    (!selectedEngine ||
      selectedEngine.specialty !== targetAgent.specialty ||
      !selectedEngine.rarity)
  )
    throw new Error('所选音擎不适用于当前代理人，请重新选择。')
  if (
    selectedEngine &&
    (!Number.isInteger(draft.wEngineLevel) ||
      (draft.wEngineLevel ?? 0) < 0 ||
      (draft.wEngineLevel ?? 0) > 60)
  )
    throw new Error('当前音擎等级必须为 0–60。')
  if (
    selectedEngine &&
    (!Number.isInteger(draft.wEngineRefinement) ||
      (draft.wEngineRefinement ?? 0) < 1 ||
      (draft.wEngineRefinement ?? 0) > 5)
  )
    throw new Error('当前音擎精炼必须为 1–5。')
  if (
    selectedEngine &&
    draft.wEngineAscension !== undefined &&
    draft.wEngineAscension !== null &&
    (!Number.isInteger(draft.wEngineAscension) ||
      draft.wEngineAscension < 0 ||
      draft.wEngineAscension > 5)
  )
    throw new Error('当前音擎突破阶段必须为 0–5 或未确认。')

  const agentsNext = roster.agents.map((agent) =>
    agent.agentId === agentId
      ? {
          ...agent,
          ...agentPatch,
          wEngineDetails: selectedEngine
            ? {
                id: selectedEngine.stableId,
                name: selectedEngine.playerName,
                level: draft.wEngineLevel ?? 60,
                ...('wEngineAscension' in draft
                  ? { ascension: draft.wEngineAscension }
                  : selectedEngine.stableId === agent.wEngineDetails.id &&
                      'ascension' in agent.wEngineDetails
                    ? { ascension: agent.wEngineDetails.ascension }
                    : {}),
                refinement: draft.wEngineRefinement ?? (selectedEngine.rarity === 'S' ? 1 : 5),
              }
            : { id: null, name: null, level: null, refinement: null },
          wEngineCopyId: null,
          manualSource: 'manual_override' as const,
        }
      : agent,
  )
  const previous = roster.agents.find((agent) => agent.agentId === agentId)
  const next = agentsNext.find((agent) => agent.agentId === agentId)
  if (previous && next) {
    const facts = normalizeObservedAgentFacts(structuredClone(previous.observedFacts))
    const sameIdentity = selectedEngine?.stableId === previous.wEngineDetails.id
    if (!sameIdentity && facts)
      for (const field of Object.keys(facts.fields))
        if (field.startsWith('wEngineDetails.'))
          delete facts.fields[field as keyof typeof facts.fields]
    if (selectedEngine) {
      const oldManual = previous.wEngineDetails.manualProgression
      const manual: NonNullable<
        AccountRoster['agents'][number]['wEngineDetails']['manualProgression']
      > =
        sameIdentity && oldManual?.engineId === selectedEngine.stableId
          ? { ...oldManual }
          : { engineId: selectedEngine.stableId }
      const fields = [
        ['level', draft.wEngineLevel, draft.wEngineLevelManuallySet],
        ['refinement', draft.wEngineRefinement, draft.wEngineRefinementManuallySet],
        ['ascension', draft.wEngineAscension, 'wEngineAscension' in draft ? true : false],
      ] as const
      for (const [field, value, explicitlyEdited] of fields) {
        // The UI marks edits explicitly; a selector's defaults are deliberately false.
        // Older programmatic callers express a targeted edit by providing a changed value.
        const confirmed =
          typeof value === 'number' &&
          (explicitlyEdited === true ||
            (explicitlyEdited === undefined &&
              (!sameIdentity || value !== previous.wEngineDetails[field])))
        if (confirmed) {
          manual[field] = value
          if (facts) delete facts.fields[`wEngineDetails.${field}`]
        } else if (manual[field] !== next.wEngineDetails[field]) delete manual[field]
      }
      // Legacy maintained rows retain their existing contract. New identities and observed
      // rows require field-specific evidence; unrelated saves cannot confirm retained values.
      if (oldManual || previous.observedFacts?.fields['wEngineDetails.id'])
        next.wEngineDetails.manualProgression = manual
    }
    next.observedFacts = normalizeObservedAgentFacts(facts)
  }
  return { ...roster, agents: agentsNext }
}

export async function saveAgentWEngineAssignment({
  accountId,
  agentId,
  baseRevision,
  draft,
  agentPatch,
  agents,
  wengines,
  db = database,
}: {
  accountId: string
  db?: SodaDatabase
  agentId: string
  baseRevision: string
  draft: AgentWEngineDraft
  agentPatch?: Partial<AccountRoster['agents'][number]>
  agents: readonly WEngineCatalogEntry[]
  wengines: readonly WEngineCatalogEntry[]
}) {
  return updateAccountRoster(
    accountId,
    (roster) => {
      if (agentWEngineRevision(roster, agentId) !== baseRevision)
        throw new Error('代理人资料已更新，请刷新后重新确认。')
      return applyAgentWEngineAssignment({ roster, agentId, draft, agentPatch, agents, wengines })
    },
    db,
  )
}
