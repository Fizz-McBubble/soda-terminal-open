import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { producerSsrModuleSpecifiers } from './runtime-source-dependencies.mjs'
import {
  collectTeamSystemRankingSourceClosure,
  currentSystemRankingSameCoreIntegrationContract,
  currentTeamSystemRankingProducerContract,
  fixedCounterexampleCoverage,
  hasDeclaredSupportReferences,
  sameCoreRecord,
  standardFiniteEventCoverage,
  standardFiniteEventControlledState,
} from './generate-team-system-ranking.mjs'

test('the producer identity covers the same-core helper and its transitive sources', async () => {
  const closure = await collectTeamSystemRankingSourceClosure()
  assert.match(closure.identity, /^fnv1a-[0-9a-f]{1,8}$/)
  assert.match(closure.sha256, /^[0-9a-f]{64}$/)
  assert.ok(closure.rows.length > 4)
  for (const required of [
    'src/decision/teamSystemRankingMethod.ts',
    'src/decision/teamSameCoreOutputComparison.ts',
    'src/decision/teamStrengthStandardFiniteEventConditions.ts',
    'src/decision/teamSameCoreApplicableCoordinates.ts',
    'src/decision/teamStrengthSupportContribution.ts',
    'src/calculation/fixedEventSupportContribution32.ts',
    'scripts/generate-team-system-ranking.mjs',
    'scripts/runtime-source-dependencies.mjs',
    'src/gameDataPacks/generated/current31-team-intrinsic-index.v1.json',
    'package.json',
    'pnpm-lock.yaml',
  ]) {
    assert.equal(
      closure.rows.some((row) => row.path === required),
      true,
      required,
    )
  }
  const producer = await readFile(
    new URL('./generate-team-system-ranking.mjs', import.meta.url),
    'utf8',
  )
  for (const input of producerSsrModuleSpecifiers(producer, 'generateTeamSystemRanking'))
    assert.ok(
      closure.rows.some((row) => row.path === input.slice(1)),
      `missing runtime SSR input ${input}`,
    )
  assert.equal(
    closure.rows.some(
      (row) => row.path === 'src/gameDataPacks/generated/team-system-ranking.v1.json',
    ),
    false,
  )
  assert.equal(
    currentTeamSystemRankingProducerContract,
    'soda-current-team-system-ranking-producer/v1',
  )
  assert.equal(
    currentSystemRankingSameCoreIntegrationContract,
    'soda-team-system-ranking-same-core-integration/v1',
  )
})

test('ranking source closure separates runtime, erased type and verification edges and detects drift', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'soda-ranking-closure-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const files = {
    'src/method.ts': `
      import type { Shape } from './type-only'
      export type { Other } from './missing-type'
      const loaded = import(\`./runtime\`)
      // import './comment-only'
      const text = "import './string-only'"
    `,
    'src/runtime.ts': 'export const value = 1',
    'src/type-only.ts': "import './gameDataPacks/generated/team-system-ranking.v1.json'",
    'src/ssr.ts': "import './facts.json' with { type: 'json' }",
    'src/facts.json': '{"value":1}',
    'src/verification-only.ts': "import './gameDataPacks/generated/team-system-ranking.v1.json'",
    'src/gameDataPacks/generated/current31-team-intrinsic-index.v1.json': '{"upstream":1}',
    'scripts/generate-team-system-ranking.mjs': `
      export async function generateTeamSystemRanking() { await server.ssrLoadModule('/src/ssr.ts') }
      export async function verifyTeamSystemRanking() { await server.ssrLoadModule('/src/verification-only.ts') }
    `,
    'package.json': '{}',
    'pnpm-lock.yaml': 'lockfileVersion: 9.0',
  }
  const save = async (file, value) => {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, value)
  }
  for (const [file, value] of Object.entries(files)) await save(file, value)
  const collect = () =>
    collectTeamSystemRankingSourceClosure(pathToFileURL(path.join(root, 'src/method.ts')), {
      sourceRoot: root,
    })
  const first = await collect()
  assert.deepEqual(
    first.rows.map((row) => row.path),
    [
      'package.json',
      'pnpm-lock.yaml',
      'scripts/generate-team-system-ranking.mjs',
      'src/facts.json',
      'src/gameDataPacks/generated/current31-team-intrinsic-index.v1.json',
      'src/method.ts',
      'src/runtime.ts',
      'src/ssr.ts',
    ],
  )
  assert.equal(
    first.rows.find((row) => row.path === 'src/runtime.ts').sha256,
    createHash('sha256').update(files['src/runtime.ts']).digest('hex'),
  )
  await save('src/type-only.ts', 'export type Shape = string')
  await save('src/verification-only.ts', 'export const validation = false')
  assert.deepEqual(await collect(), first)
  await save('src/runtime.ts', 'export const value = 2')
  assert.notEqual((await collect()).sha256, first.sha256)
  await save('src/method.ts', "import './gameDataPacks/generated/team-system-ranking.v1.json'")
  await assert.rejects(collect(), /generated-output back edge/)
  await assert.rejects(
    collectTeamSystemRankingSourceClosure(pathToFileURL(path.dirname(root)), { sourceRoot: root }),
    /escaped app root/,
  )
})

test('absent source triggers are not promoted to a declared same-core packet', () => {
  assert.equal(hasDeclaredSupportReferences({ potentialByAgentId: {}, evidenceRefs: [] }), false)
  assert.equal(
    hasDeclaredSupportReferences({
      potentialByAgentId: {},
      evidenceRefs: [],
      supportReferencesByAgentId: { 'agent-a': {} },
    }),
    false,
  )
  assert.equal(
    hasDeclaredSupportReferences({
      potentialByAgentId: {},
      evidenceRefs: [],
      supportReferencesByAgentId: { 'agent-a': { trigger: false } },
    }),
    true,
  )
})

test('partial joint evidence keeps unknown keys and never emits a numeric value', () => {
  const referenceConditions = {
    identity: 'fnv1a-reference',
    status: 'standard_reference',
    sourceAuthority: 'strength_gold',
  }
  const evidence = {
    input: {
      baseline: { baselineId: 'fixture' },
      eventUsages: [{ eventId: 'owner-event' }],
      baselineReferencesByAgentId: { 'agent-a': { trigger: false } },
    },
    eventPacketIdentity: 'fnv1a-event',
    outputSystem: 'direct_damage',
    result: {
      status: 'partial',
      fixedEventValue: 123,
      consumedBuckets: [],
      unknownEffects: [{ effectKey: 'unknown-effect' }],
    },
  }
  const record = sameCoreRecord({
    memberIds: ['agent-a', 'agent-b', 'agent-c'],
    subjectAgentId: 'agent-a',
    referenceConditions,
    construction: { status: 'ready', input: evidence.input, protocol: 'fixture' },
    evidence,
  })
  assert.equal(record.status, 'partial')
  assert.equal(record.fixedEventValue, null)
  assert.deepEqual(record.unknownEffectKeys, ['unknown-effect'])
})

test('partial source exclusions remain visible without inventing unknown effect keys', () => {
  const exclusion = {
    effectKey: 'agent-zhao:reviewed_m1_switch_out_resistance_ignore32',
    reason: 'event state not observed',
    fields: ['zhaoM1SwitchedOut32', 'zhaoM1SecondsSinceSwitchOut32'],
    sourceRefs: ['fixture:source'],
  }
  const evidence = {
    input: { baseline: {}, eventUsages: [], baselineReferencesByAgentId: {} },
    result: {
      status: 'partial',
      fixedEventValue: 1,
      consumedBuckets: [],
      unknownEffects: [],
      exclusions: [exclusion],
    },
  }
  const record = sameCoreRecord({
    memberIds: ['agent-a', 'agent-b', 'agent-c'],
    subjectAgentId: 'agent-a',
    referenceConditions: {
      identity: 'fixture',
      status: 'standard_reference',
      sourceAuthority: 'none',
    },
    construction: { status: 'ready', input: evidence.input, protocol: 'fixture' },
    evidence,
  })
  assert.equal(record.status, 'partial')
  assert.equal(record.fixedEventValue, null)
  assert.deepEqual(record.unknownEffectKeys, [])
  assert.deepEqual(record.sourceExclusions, [exclusion])
})

test('all original nine pairs stay in the replay denominator', () => {
  const pairs = fixedCounterexamplePairsForTest()
  const exactOwnerTeams = new Set([
    [...pairs[7].left].sort().join('|'),
    [...pairs[7].right].sort().join('|'),
  ])
  const candidateOwnerByKey = new Map()
  for (const pair of pairs)
    for (const memberIds of [pair.left, pair.right]) {
      const key = [...memberIds].sort().join('|')
      if (!candidateOwnerByKey.has(key))
        candidateOwnerByKey.set(
          key,
          exactOwnerTeams.has(key)
            ? 'agent-ye-shunguang'
            : `agent-owner-${candidateOwnerByKey.size}`,
        )
    }
  const candidates = []
  for (const [key, owner] of candidateOwnerByKey) {
    const memberIds = key.split('|')
    candidates.push({
      memberIds,
      profile: { primaryOutputAgentId: owner },
    })
  }
  const coverage = fixedCounterexampleCoverage(candidates, () => 'incomparable')
  assert.equal(coverage.total, 9)
  assert.equal(coverage.preserved, 9)
  assert.equal(coverage.crossOwnerIncomparable, 8)
  assert.equal(coverage.boundaryViolations, 0)
  assert.equal(
    coverage.records.find((record) => record.samePrimaryOutput)?.id,
    'dialyn-sunna-ye-shunguang__trigger-ye-shunguang-zhao',
  )
})

test('the producer carries three explicit standard finite-event relationships', () => {
  const coverage = standardFiniteEventCoverage({
    createConditions: ({ subjectAgentId }) => ({
      status: 'supported',
      identity: `conditions:${subjectAgentId}`,
      bindings: [
        {
          referenceKey: 'fixture',
          recipientAgentIds: [subjectAgentId],
          sourceRefs: ['fixture:source'],
        },
      ],
      unboundConditionalReferences: {},
      referenceConditions: {
        supportReferencesByAgentId: { [subjectAgentId]: { fixture: true } },
      },
    }),
    createInput: () => ({ status: 'ready', input: { fixture: true } }),
    project: () => ({
      result: { status: 'supported' },
    }),
    compare: () => ({
      relation: 'right',
      fixedEventDelta: -1,
    }),
    contract: 'soda-team-standard-finite-event-replay/v1',
    scenario: 'declared-single-event-source-window',
  })
  assert.equal(coverage.total, 3)
  assert.equal(coverage.supported, 3)
  assert.equal(coverage.ordered, 3)
  assert.equal(coverage.records.length, 3)
  assert.equal(
    coverage.records.every((record) => record.bindings.left.length === 1),
    true,
  )
})

test('standard comparison records name the missing source state instead of inventing an order', () => {
  const exclusion = {
    effectKey: 'agent-zhao:reviewed_m1_switch_out_resistance_ignore32',
    reason: 'not observed',
    fields: ['zhaoM1SwitchedOut32', 'zhaoM1SecondsSinceSwitchOut32'],
    sourceRefs: ['fixture:source'],
  }
  const coverage = standardFiniteEventCoverage({
    createConditions: () => ({
      status: 'supported',
      identity: 'fixture',
      bindings: [],
      unboundConditionalReferences: {},
      referenceConditions: {},
    }),
    createInput: () => ({ status: 'ready', input: {} }),
    project: () => ({ result: { status: 'partial', exclusions: [exclusion] } }),
    compare: () => ({ relation: 'incomparable', fixedEventDelta: null }),
    contract: 'soda-team-standard-finite-event-replay/v1',
    scenario: 'declared-single-event-source-window',
  })
  assert.equal(coverage.supported, 0)
  assert.equal(coverage.ordered, 0)
  assert.deepEqual(coverage.records[0].sourceExclusions, { left: [exclusion], right: [exclusion] })
})

test('controlled validation binds source state while the undeclared replay remains partial', () => {
  const state = standardFiniteEventControlledState(
    { enemy: { id: 'target' } },
    { commit: 'locked', retainedFileSha256: { Sunna: 'sha' } },
    'state-identity',
  )
  const observed = []
  const coverage = standardFiniteEventCoverage({
    controlledState: state,
    createConditions: (input) => {
      observed.push(input)
      return {
        status: 'supported',
        bindings: [{ sourceRefs: ['source'] }],
        referenceConditions: { input },
      }
    },
    createInput: ({ referenceConditions }) => ({
      status: 'ready',
      input: referenceConditions.input,
    }),
    project: (input) => ({
      result: input.eventObservation
        ? { status: 'supported' }
        : {
            status: 'partial',
            exclusions: [
              {
                effectKey: 'missing',
                fields: input.memberIds.includes('agent-sunna')
                  ? ['sunnaCatGazeStacks32']
                  : ['zhaoM1SwitchedOut32', 'zhaoM1SecondsSinceSwitchOut32'],
                sourceRefs: [],
              },
            ],
          },
    }),
    compare: (left, right) => ({
      relation:
        left.result.status === 'supported' && right.result.status === 'supported'
          ? 'right'
          : 'incomparable',
      fixedEventDelta: -1,
    }),
    contract: 'contract',
    scenario: 'scenario',
  })
  assert.equal(coverage.supported, 3)
  assert.equal(coverage.undeclared.length, 2)
  assert.ok(
    coverage.undeclared.every(
      (row) =>
        row.leftStatus === 'partial' &&
        row.rightStatus === 'partial' &&
        row.relation === 'incomparable',
    ),
  )
  assert.equal(state.eventObservation.atSeconds, 10)
  assert.equal(
    state.baselineReferencesByAgentId['agent-sunna'].reviewedTargetEffectState32.stacks,
    0,
  )
  assert.equal(state.baselineReferencesByAgentId['agent-zhao'].zhaoM1SwitchedOut32, false)
  assert.ok(
    state.baselineReferencesByAgentId[
      'agent-sunna'
    ].reviewedTargetEffectState32.sourceRefs[0].includes('sha'),
  )
  assert.equal(observed.filter((row) => !row.eventObservation).length, 4)
  assert.ok(
    observed
      .filter((row) => row.eventObservation)
      .every((row) =>
        Object.keys(row.baselineReferencesByAgentId).every((id) => row.memberIds.includes(id)),
      ),
  )
})

function fixedCounterexamplePairsForTest() {
  return [
    {
      id: 'alice-corin-nicole__lycaon-miyabi-soukaku',
      left: ['agent-alice', 'agent-corin', 'agent-nicole'],
      right: ['agent-lycaon', 'agent-miyabi', 'agent-soukaku'],
    },
    {
      id: 'alice-corin-nicole__piper-velina-yuzuha',
      left: ['agent-alice', 'agent-corin', 'agent-nicole'],
      right: ['agent-piper', 'agent-velina', 'agent-yuzuha'],
    },
    {
      id: 'aria-nangong-sunna__nangong-promeia-yuzuha',
      left: ['agent-aria', 'agent-nangong', 'agent-sunna'],
      right: ['agent-nangong', 'agent-promeia', 'agent-yuzuha'],
    },
    {
      id: 'aria-sunna-yuzuha__nangong-promeia-yuzuha',
      left: ['agent-aria', 'agent-sunna', 'agent-yuzuha'],
      right: ['agent-nangong', 'agent-promeia', 'agent-yuzuha'],
    },
    {
      id: 'astra-qingyi-zhu-yuan__dialyn-sunna-ye-shunguang',
      left: ['agent-astra', 'agent-qingyi', 'agent-zhu-yuan'],
      right: ['agent-dialyn', 'agent-sunna', 'agent-ye-shunguang'],
    },
    {
      id: 'astra-qingyi-zhu-yuan__sunna-ye-shunguang-zhao',
      left: ['agent-astra', 'agent-qingyi', 'agent-zhu-yuan'],
      right: ['agent-sunna', 'agent-ye-shunguang', 'agent-zhao'],
    },
    {
      id: 'caesar-jane-seth__nicole-promeia-soukaku',
      left: ['agent-caesar', 'agent-jane', 'agent-seth'],
      right: ['agent-nicole', 'agent-promeia', 'agent-soukaku'],
    },
    {
      id: 'dialyn-sunna-ye-shunguang__trigger-ye-shunguang-zhao',
      left: ['agent-dialyn', 'agent-sunna', 'agent-ye-shunguang'],
      right: ['agent-trigger', 'agent-ye-shunguang', 'agent-zhao'],
    },
    {
      id: 'nicole-promeia-soukaku__piper-velina-yuzuha',
      left: ['agent-nicole', 'agent-promeia', 'agent-soukaku'],
      right: ['agent-piper', 'agent-velina', 'agent-yuzuha'],
    },
  ]
}
