import catalog from '../gameDataPacks/generated/current-agent-resource-events32.v1.json'

export const currentAgentResourceEventIdentity32 = Object.freeze({
  sourceCommit: catalog.sourceCommit,
  contentHash: catalog.contentHash,
  coverage: catalog.coverage,
  sourceUnits: catalog.sourceUnits,
  gamePointConversion: catalog.gamePointConversion,
})

const eventsByAgent = new Map(
  catalog.items.map((agent) => [
    agent.upstreamKey,
    {
      source: agent.source,
      events: new Map(agent.events.map((event) => [event.eventId, event])),
    },
  ]),
)

/** Resource rows remain usable independently of a damage formula's projection. */
export function getCurrentAgentResourceEvent32(upstreamKey: string, eventId: string) {
  const agent = eventsByAgent.get(upstreamKey)
  const event = agent?.events.get(eventId)
  return event && agent ? { event, source: agent.source } : null
}
