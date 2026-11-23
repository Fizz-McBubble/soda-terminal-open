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
  if (currentGameDataSelection.gameVersion !== '3.2') throw Error('Freeze requires installed 3.2')
  const { currentBuildAuthority, selectedGuidanceField } = await server.ssrLoadModule(
    '/src/gameDataPacks/currentBuildAuthority.ts',
  )
  const { getAgentProfile } = await server.ssrLoadModule('/src/gameDataPacks/agentProfile.ts')
  const { currentAgentEventContracts } = await server.ssrLoadModule(
    '/src/calculation/currentAgentMechanicContracts.ts',
  )
  const { stableContentHash } = await server.ssrLoadModule('/src/gameDataPacks/types.ts')
  const entries = currentBuildAuthority.profiles.flatMap((profile) =>
    profile.guidance.fields
      .filter((field) => field.state === 'ready')
      .map((field) => {
        const selected = selectedGuidanceField(
          field.fieldId,
          getAgentProfile(profile.stableId).fields,
          profile.stableId,
        )
        if (!selected || stableContentHash(selected.value) !== stableContentHash(field.value))
          throw Error('Selected payload differs')
        return {
          agentId: profile.stableId,
          fieldId: field.fieldId,
          valueHash: stableContentHash(selected.value),
          sourceRefsHash: stableContentHash(selected.sourceRefs),
          conditionsHash: stableContentHash(selected.conditions ?? []),
          sourceReviewVersion: selected.gameVersion,
        }
      }),
  )
  if (entries.length !== 551 || currentBuildAuthority.profiles.length !== 60)
    throw Error(
      `Expected 551/60, received ${entries.length}/${currentBuildAuthority.profiles.length}`,
    )
  const data = {
    schema: 'soda-reviewed-build-field-continuity/v1',
    id: 'reviewed-build-field-continuity-3.2-to-3.3-r1',
    targetVersion: '3.3',
    sourceReviewVersion: '3.2',
    scope: 'formed_generic_guidance_reference',
    sourceDeltaHash: 'DD6B87A5CBFBB965726D2C79297F630EBCA85187AF09F7802A6F4D0D5B3A0AE0',
    boundary: {
      strengthPromotion: false,
      runtimePromotion: false,
      formalPromotion: false,
      importPromotion: false,
      exactDps: false,
    },
    formulaBindings: currentAgentEventContracts.map((c) => ({
      agentId: c.stableId,
      formulaSha256: c.source.formulaSha256,
    })),
    entries,
  }
  writeFileSync(
    'src/gameDataPacks/data/reviewed-build-field-continuity.3.3.json',
    JSON.stringify(data, null, 2) + '\n',
  )
  console.log(
    JSON.stringify({
      entries: entries.length,
      actors: data.formulaBindings.length,
      hash: stableContentHash(data),
    }),
  )
} finally {
  await server.close()
}
