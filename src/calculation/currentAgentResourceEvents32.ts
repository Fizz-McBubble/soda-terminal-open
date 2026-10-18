import catalog from '../gameDataPacks/generated/current-agent-resource-events32.v1.json'

export const currentAgentResourceEventIdentity32 = Object.freeze({
  sourceCommit: catalog.sourceCommit,
  contentHash: catalog.contentHash,
  coverage: catalog.coverage,
  sourceUnits: catalog.sourceUnits,
  gamePointConversion: catalog.gamePointConversion,
})

export const currentAgentResourceGamePointConversion32 = Object.freeze({
  schema: 'soda-resource-point-conversion/v1',
  energy: Object.freeze({
    status: 'verified' as const,
    upstreamUnitsPerPoint: 100,
    sourceCommit: catalog.sourceCommit,
    sourcePath: 'libs/zzz/stats/Data/Characters/Alice.json',
    evidence:
      'Alice BasicAttackCelestialOverture SpRecovery 144.1/253.8/217.9/382/478.7/766.7 matches source energy_regen 1.441/2.538/2.179/3.82/4.787/7.667.',
  }),
  decibels: Object.freeze({
    status: 'limited_benchmark' as const,
    usage: 'comparison_benchmark_only' as const,
    upstreamUnitsPerPoint: 100,
    sourceCommit: catalog.sourceCommit,
    sourcePath: 'libs/zzz/stats/Data/Characters/Alice.json',
    crossValidation: Object.freeze({
      repository: 'Overcommon7/ZZZCalculator',
      commit: '60c1774828f1f2bc72a7bcb436bab02ba6bf29cf',
      path: 'Parsing/Parsing/AgentAttacks.cs',
      sha256: 'AA4F950331EC4315581651335E593F77F6123EA65FFDE62B8D4A051EADDD6520',
      licenseStatus: 'not_declared',
      reuse: 'benchmark_only' as const,
      evidence:
        'Legacy Hakushin FeverRecovery is scaled by 0.0001 to game Decibels. The pinned optimizer stores the same raw rows at 1/100, so one game Decibel is 100 upstream_FeverRecovery units.',
    }),
    boundary:
      'The conversion is suitable for bounded comparison benchmarks only. It is not independently verified against a game-client capture and cannot close Formal or a complete resource cycle by itself.',
  }),
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
