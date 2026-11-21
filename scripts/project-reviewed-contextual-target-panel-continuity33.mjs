import { createServer } from 'vite'
import { writeFileSync } from 'node:fs'
const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
})
try {
  const { currentGameDataSelection } = await server.ssrLoadModule(
    '/src/gameDataPacks/currentGameDataSelection.ts',
  )
  if (currentGameDataSelection.gameVersion !== '3.2') throw Error('Context freeze requires 3.2')
  const { getCurrentBuildTargetPanel } = await server.ssrLoadModule(
    '/src/gameDataPacks/currentBuildAuthority.ts',
  )
  const { currentAgentEventContracts } = await server.ssrLoadModule(
    '/src/calculation/currentAgentMechanicContracts.ts',
  )
  const { stableContentHash } = await server.ssrLoadModule('/src/gameDataPacks/types.ts')
  const teams = [
    ['agent-miyabi', 'agent-lycaon', 'agent-soukaku'],
    ['agent-miyabi', 'agent-remielle', 'agent-burnice'],
  ]
  const entries = teams.map((memberIds) => {
    const panel = getCurrentBuildTargetPanel('agent-miyabi', { memberIds, mindscape: 0 })
    if (!panel) throw Error('Missing traditional panel')
    for (let mindscape = 1; mindscape <= 6; mindscape++)
      if (
        stableContentHash(getCurrentBuildTargetPanel('agent-miyabi', { memberIds, mindscape })) !==
        stableContentHash(panel)
      )
        throw Error('Mindscape-specific branch needs explicit review')
    return {
      memberIds: [...memberIds].sort(),
      valueHash: stableContentHash(panel.value),
      sourceRefsHash: stableContentHash(panel.sourceRefs),
      conditionsHash: stableContentHash(panel.conditions),
      formulaBindings: memberIds.map((agentId) => ({
        agentId,
        formulaSha256: currentAgentEventContracts.find((c) => c.stableId === agentId).source
          .formulaSha256,
      })),
    }
  })
  const output = {
    schema: 'soda-reviewed-contextual-target-panel-continuity/v1',
    scope: 'generic_target_panel_reference33',
    targetVersion: '3.3',
    sourceReviewVersion: '3.2',
    sourceDeltaHash: 'DD6B87A5CBFBB965726D2C79297F630EBCA85187AF09F7802A6F4D0D5B3A0AE0',
    entries,
  }
  writeFileSync(
    'src/gameDataPacks/data/reviewed-contextual-target-panel-continuity.3.3.json',
    JSON.stringify(output, null, 2) + '\n',
  )
  console.log(JSON.stringify({ entries: entries.length, hash: stableContentHash(output) }))
} finally {
  await server.close()
}
