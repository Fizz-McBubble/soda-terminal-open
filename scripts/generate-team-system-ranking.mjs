import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { fork } from 'node:child_process'
import { resolveBuildStorage } from './derived-build-storage.mjs'
import {
  collectRuntimeSourceInputs,
  producerSsrModuleSpecifiers,
} from './runtime-source-dependencies.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const defaultOutput = new URL(
  '../src/gameDataPacks/generated/team-system-ranking.v1.json',
  import.meta.url,
)
const intrinsicIndexUrl = new URL(
  '../src/gameDataPacks/generated/current31-team-intrinsic-index.v1.json',
  import.meta.url,
)
const methodUrl = new URL('../src/decision/teamSystemRankingMethod.ts', import.meta.url)
const generatorUrl = new URL(import.meta.url)

export const currentTeamSystemRankingProducerContract =
  'soda-current-team-system-ranking-producer/v1'
export const currentSystemRankingSameCoreIntegrationContract =
  'soda-team-system-ranking-same-core-integration/v1'
const systems = ['direct_damage', 'attribute_anomaly', 'rupture', 'aftershock', 'sharp']
const statuses = ['ranked', 'unsupported']
const classificationBases = [
  'reviewed_exact_team_output_module',
  'primary_special_output_family',
  'anomaly_output_capacity',
  'standard_direct_output',
]
const reasons = [
  'mechanic_evidence_missing',
  'member_action_evidence_unavailable',
  'invalid_mechanics',
  'no_primary_output',
  'no_classifiable_output',
  'nonfinite_mechanic_capacity',
]
const requiredRankingSourcePaths = [
  'src/decision/teamSystemRankingMethod.ts',
  'src/decision/teamSameCoreOutputComparison.ts',
  'src/decision/teamStrengthStandardFiniteEventConditions.ts',
  'src/decision/teamSameCoreApplicableCoordinates.ts',
  'src/decision/teamStrengthSupportContribution.ts',
  'src/calculation/fixedEventSupportContribution32.ts',
]
const standardFiniteEventComparisonPairs = [
  {
    id: 'dialyn-sunna-ye-shunguang__trigger-ye-shunguang-zhao',
    subjectAgentId: 'agent-ye-shunguang',
    left: ['agent-dialyn', 'agent-sunna', 'agent-ye-shunguang'],
    right: ['agent-trigger', 'agent-ye-shunguang', 'agent-zhao'],
  },
  {
    id: 'ye-sunna-billy__ye-zhao-billy',
    subjectAgentId: 'agent-ye-shunguang',
    left: ['agent-ye-shunguang', 'agent-sunna', 'agent-billy'],
    right: ['agent-ye-shunguang', 'agent-zhao', 'agent-billy'],
  },
  {
    id: 'ye-dialyn-billy__ye-trigger-billy',
    subjectAgentId: 'agent-ye-shunguang',
    left: ['agent-ye-shunguang', 'agent-dialyn', 'agent-billy'],
    right: ['agent-ye-shunguang', 'agent-trigger', 'agent-billy'],
  },
]
const fixedCounterexamplePairs = [
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

function stableHash(input) {
  const value = typeof input === 'string' ? input : JSON.stringify(input)
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sourceClosurePath(fileUrlOrPath, sourceRoot = root) {
  const absolute =
    fileUrlOrPath instanceof URL ? fileURLToPath(fileUrlOrPath) : path.resolve(fileUrlOrPath)
  const relative = path.relative(sourceRoot, absolute).split(path.sep).join('/')
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative))
    throw new Error(`Ranking source closure escaped app root: ${absolute}`)
  return { absolute, relative }
}

export async function collectTeamSystemRankingSourceClosure(
  startUrl = methodUrl,
  { sourceRoot = root } = {},
) {
  const producerPath = 'scripts/generate-team-system-ranking.mjs'
  const producer = await readFile(path.resolve(sourceRoot, producerPath), 'utf8')
  const entries = [
    sourceClosurePath(startUrl, sourceRoot).relative,
    producerPath,
    'package.json',
    'pnpm-lock.yaml',
    'src/gameDataPacks/generated/current31-team-intrinsic-index.v1.json',
    ...producerSsrModuleSpecifiers(producer, 'generateTeamSystemRanking').map((specifier) =>
      specifier.replace(/^\//u, ''),
    ),
  ]
  const inputs = await collectRuntimeSourceInputs({
    root: sourceRoot,
    entries,
    forbiddenInputs: ['src/gameDataPacks/generated/team-system-ranking.v1.json'],
    label: 'Ranking source closure',
  })
  const rows = inputs.map((input) => ({ path: input.path, sha256: sha256(input.content) }))
  const serialized = JSON.stringify(rows)
  return {
    rows,
    identity: stableHash(serialized),
    sha256: sha256(serialized),
  }
}

function exactArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  )
}

function valueIndex(values, value) {
  const index = values.indexOf(value)
  if (index < 0) throw new Error(`Unknown value: ${value}`)
  return index
}

function featureValue(features, name) {
  const index = features.featureNames.indexOf(name)
  return index < 0 ? null : (features.values[index] ?? null)
}

function profilePairAgreement(candidates, references, dictionary, compareCandidates) {
  const candidateByKey = new Map(
    candidates.map((candidate) => [[...candidate.memberIds].sort().join('|'), candidate]),
  )
  let compared = 0
  let correct = 0
  let ties = 0
  let incomparable = 0
  for (let leftIndex = 0; leftIndex < references.length; leftIndex += 1)
    for (let rightIndex = leftIndex + 1; rightIndex < references.length; rightIndex += 1) {
      const left = references[leftIndex]
      const right = references[rightIndex]
      if (left.band === right.band || left.system !== right.system) continue
      const leftCandidate = candidateByKey.get([...left.memberIds].sort().join('|'))
      const rightCandidate = candidateByKey.get([...right.memberIds].sort().join('|'))
      if (!leftCandidate || !rightCandidate) continue
      compared += 1
      const relation = compareCandidates(
        leftCandidate.profile,
        rightCandidate.profile,
        leftCandidate.mechanicInput,
        rightCandidate.mechanicInput,
      )
      if (relation === 'tie') {
        ties += 1
        continue
      }
      if (relation === 'incomparable') {
        incomparable += 1
        continue
      }
      const expected =
        dictionary.bands.indexOf(left.band) < dictionary.bands.indexOf(right.band) ? 1 : -1
      const actual = relation === 'left' ? 1 : -1
      if (expected === actual) correct += 1
    }
  const ordered = compared - ties - incomparable
  return {
    compared,
    ordered,
    agreeing: correct,
    ties,
    incomparable,
    agreeingAmongOrdered: correct / Math.max(1, ordered),
  }
}

export function hasDeclaredSupportReferences(referenceConditions) {
  return Object.values(referenceConditions.supportReferencesByAgentId ?? {}).some(
    (references) => Object.keys(references).length > 0,
  )
}

export async function readRankingCheckpoint(file, expected) {
  const saved = JSON.parse(await readFile(file, 'utf8'))
  const content = saved.content
  if (
    saved.sha256 !== sha256(JSON.stringify(content)) ||
    content.contract !== 'soda-ranking-inference-checkpoint/v1' ||
    content.fingerprint !== expected.fingerprint ||
    content.start !== expected.start ||
    content.end !== expected.end
  )
    throw new Error('Ranking checkpoint source/range/content mismatch.')
  const ordinals = [...content.candidates, ...content.unsupported].map((row) => row.ordinal)
  if (
    ordinals.length !== expected.end - expected.start ||
    new Set(ordinals).size !== ordinals.length ||
    ordinals.some(
      (ordinal) =>
        !Number.isInteger(ordinal) || ordinal < expected.start || ordinal >= expected.end,
    )
  )
    throw new Error('Ranking checkpoint lost or duplicated a candidate.')
  return content
}

export function encodeRankingSourcePins(
  value,
  pins,
  indices = new Map(pins.map((pin, index) => [pin, index])),
) {
  const visit = (node, key) => {
    if (Array.isArray(node))
      return node.map((item) => {
        if ((key === 'sourceRefs' || key === 'evidenceRefs') && typeof item === 'string') {
          let index = indices.get(item)
          if (index === undefined) {
            index = pins.length
            pins.push(item)
            indices.set(item, index)
          }
          return `soda-ranking-source-pin:${index}`
        }
        return visit(item, '')
      })
    if (node && typeof node === 'object')
      return Object.fromEntries(
        Object.entries(node).map(([name, item]) => [name, visit(item, name)]),
      )
    return node
  }
  return visit(value, '')
}

export function decodeRankingSourcePins(value, pins) {
  const visit = (node) => {
    if (typeof node === 'string' && node.startsWith('soda-ranking-source-pin:')) {
      const suffix = node.slice('soda-ranking-source-pin:'.length)
      if (!/^(0|[1-9]\d*)$/.test(suffix) || typeof pins[Number(suffix)] !== 'string')
        throw new Error('Invalid ranking source pin.')
      return pins[Number(suffix)]
    }
    if (Array.isArray(node)) return node.map(visit)
    if (node && typeof node === 'object')
      return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, visit(item)]))
    return node
  }
  return visit(value)
}

/** Frozen original global nested loop, replayed on the SAME detached profiles.
 * No owner pruning here: this is the full-domain numerical equivalence check. */
export function replayOriginalSystemRanks(rows, compare, compareProfilesForOrder) {
  const ranks = Array(rows.length).fill(0)
  const depths = Array(rows.length).fill(0)
  for (const system of [...new Set(rows.map((row) => row.system))]) {
    const ordered = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.system === system)
      .sort((a, b) => compareProfilesForOrder(a.row.profile, b.row.profile) || a.index - b.index)
    const systemDepths = []
    for (let i = 0; i < ordered.length; i++) {
      let depth = 1
      for (let j = 0; j < i; j++)
        if (systemDepths[j] + 1 > depth && compare(ordered[j].row, ordered[i].row) === 'left')
          depth = systemDepths[j] + 1
      systemDepths.push(depth)
      depths[ordered[i].index] = depth
    }
    const dense = new Map(
      [...new Set(systemDepths)].sort((a, b) => a - b).map((d, i) => [d, i + 1]),
    )
    for (let i = 0; i < ordered.length; i++) ranks[ordered[i].index] = dense.get(systemDepths[i])
  }
  return { ranks, depths }
}

function finiteEventSourceExclusions(result) {
  if (!result || result.status !== 'partial') return []
  return (result.exclusions ?? [])
    .filter((item) => !item.fields?.includes('outside_direct_event_formula'))
    .map(({ effectKey, reason, fields, sourceRefs }) => ({
      effectKey,
      reason,
      fields,
      sourceRefs,
    }))
}

export function sameCoreRecord({
  memberIds,
  subjectAgentId,
  referenceConditions,
  construction,
  evidence,
}) {
  const input = construction.status === 'ready' ? construction.input : evidence?.input
  const result = evidence?.result
  const consumedBuckets =
    result && result.status !== 'unsupported'
      ? result.consumedBuckets.map(
          ({ providerAgentId, recipientAgentIds, application, value, sourceRefs }) => ({
            providerAgentId,
            recipientAgentIds,
            application,
            value,
            sourceRefs,
          }),
        )
      : []
  return {
    memberIds,
    subjectAgentId,
    protocol:
      construction.status === 'ready' ? construction.protocol : 'source-packet-construction-failed',
    status:
      construction.status === 'unsupported'
        ? 'unsupported'
        : (evidence?.result.status ?? 'unsupported'),
    referenceIdentity: referenceConditions.identity,
    referenceStatus: referenceConditions.status,
    sourceAuthority: referenceConditions.sourceAuthority,
    conditionBindingIdentity: referenceConditions.conditionBindingIdentity ?? null,
    conditionBindingBoundary: referenceConditions.conditionBindingBoundary ?? null,
    conditionBindingScenario: referenceConditions.conditionBindingScenario ?? null,
    eventPacketIdentity: evidence?.eventPacketIdentity ?? null,
    outputSystem: evidence?.outputSystem ?? null,
    baselineIdentity: input ? stableHash(input.baseline) : null,
    eventUsages: input?.eventUsages ?? [],
    phoenixCanonicalEvent33: input?.phoenixCanonicalEvent33 ?? null,
    declaredReferences: input?.baselineReferencesByAgentId ?? {},
    fixedEventValue:
      result?.status === 'supported' && Number.isFinite(result.fixedEventValue)
        ? result.fixedEventValue
        : null,
    consumedBuckets,
    unknownEffectKeys:
      result && result.status !== 'unsupported'
        ? [...new Set(result.unknownEffects.map((row) => row.effectKey))].sort()
        : [],
    sourceExclusions: finiteEventSourceExclusions(result),
    blockers:
      construction.status === 'unsupported'
        ? construction.blockers
        : result?.status === 'unsupported'
          ? result.blockers
          : [],
    boundary: 'Declared finite joint event only; not a complete rotation, DPS or global optimum.',
  }
}

export function fixedCounterexampleCoverage(
  candidates,
  compareCandidates,
  diagnoseSameCore = () => null,
) {
  const candidateByKey = new Map(
    candidates.map((candidate) => [[...candidate.memberIds].sort().join('|'), candidate]),
  )
  const records = fixedCounterexamplePairs.map((pair) => {
    const left = candidateByKey.get([...pair.left].sort().join('|'))
    const right = candidateByKey.get([...pair.right].sort().join('|'))
    if (!left || !right)
      return {
        id: pair.id,
        fullMemberIds: { left: pair.left, right: pair.right },
        relation: 'unsupported',
        samePrimaryOutput: false,
        status: !left ? 'left_candidate_missing' : 'right_candidate_missing',
      }
    const relation = compareCandidates(left, right)
    const samePrimaryOutput =
      Boolean(left.profile.primaryOutputAgentId) &&
      left.profile.primaryOutputAgentId === right.profile.primaryOutputAgentId
    return {
      id: pair.id,
      fullMemberIds: { left: pair.left, right: pair.right },
      primaryOutputAgentIds: {
        left: left.profile.primaryOutputAgentId ?? null,
        right: right.profile.primaryOutputAgentId ?? null,
      },
      samePrimaryOutput,
      relation,
      ...(samePrimaryOutput ? { sameCoreDiagnostic: diagnoseSameCore(pair) } : {}),
      status: samePrimaryOutput
        ? relation === 'incomparable'
          ? 'same_owner_joint_source_conditions_incomplete'
          : 'same_owner_declared_finite_event_compared'
        : relation === 'incomparable'
          ? 'different_primary_output_incomparable'
          : 'boundary_violation',
    }
  })
  return {
    contract: 'soda-team-system-ranking-fixed-counterexamples/v1',
    total: fixedCounterexamplePairs.length,
    preserved: records.length,
    crossOwnerIncomparable: records.filter(
      (record) => !record.samePrimaryOutput && record.relation === 'incomparable',
    ).length,
    boundaryViolations: records.filter((record) => record.status === 'boundary_violation').length,
    records,
  }
}

export function standardFiniteEventControlledState(baseline, source, sourceHash) {
  const eventObservation = { targetId: baseline.enemy.id, atSeconds: 10 }
  return {
    id: 'controlled-no-cat-gaze-no-zhao-switch-v1',
    eventObservation,
    baselineReferencesByAgentId: {
      'agent-sunna': {
        sunnaDelusionStunWindow32: false,
        reviewedTargetEffectState32: {
          kind: 'sunna_cat_gaze',
          targetId: eventObservation.targetId,
          sourceIdentityHash: sourceHash,
          sourceRefs: [
            `frzyc/genshin-optimizer@${source.commit}:libs/zzz/dm-localization/assets/locales/en/char_Sunna_gen.json#sha256=${source.retainedFileSha256.Sunna}#/mindscapes/1/desc`,
            'controlled-fixed-event-no-cat-gaze-applications',
          ],
          stacks: 0,
          appliedAtSeconds: [],
        },
      },
      'agent-zhao': { zhaoM1SwitchedOut32: false },
    },
    boundary: '具名受控单事件验证状态，不是账户观测、实战触发或运行时默认。',
  }
}

export function standardFiniteEventCoverage({
  createConditions,
  createInput,
  project,
  compare,
  contract,
  scenario,
  controlledState,
}) {
  const evidenceFor = (memberIds, subjectAgentId, controlled = true) => {
    const conditions = createConditions({
      memberIds,
      subjectAgentId,
      ...(controlled && controlledState
        ? {
            eventObservation: controlledState.eventObservation,
            baselineReferencesByAgentId: Object.fromEntries(
              memberIds
                .filter((id) => controlledState.baselineReferencesByAgentId[id])
                .map((id) => [id, controlledState.baselineReferencesByAgentId[id]]),
            ),
          }
        : {}),
    })
    if (conditions.status !== 'supported')
      return {
        conditions,
        evidence: null,
      }
    const declaration = createInput({
      memberIds,
      subjectAgentId,
      referenceConditions: conditions.referenceConditions,
      baselineReferencesByAgentId: conditions.referenceConditions.supportReferencesByAgentId ?? {},
    })
    if (declaration.status !== 'ready')
      return {
        conditions,
        evidence: null,
        construction: declaration,
      }
    return {
      conditions,
      evidence: project(declaration.input),
    }
  }
  const records = standardFiniteEventComparisonPairs.map((pair) => {
    const left = evidenceFor(pair.left, pair.subjectAgentId)
    const right = evidenceFor(pair.right, pair.subjectAgentId)
    const comparison =
      left.evidence && right.evidence ? compare(left.evidence, right.evidence) : null
    return {
      id: pair.id,
      subjectAgentId: pair.subjectAgentId,
      memberIds: { left: pair.left, right: pair.right },
      leftStatus:
        left.evidence?.result.status ??
        (left.construction?.status === 'unsupported' ? 'unsupported' : 'partial'),
      rightStatus:
        right.evidence?.result.status ??
        (right.construction?.status === 'unsupported' ? 'unsupported' : 'partial'),
      relation: comparison?.relation ?? 'incomparable',
      fixedEventDelta: comparison?.fixedEventDelta ?? null,
      conditionIdentity: {
        left: left.conditions.identity ?? null,
        right: right.conditions.identity ?? null,
      },
      sourceIdentity: {
        left: left.conditions.status === 'supported' ? left.conditions.sourceIdentity : null,
        right: right.conditions.status === 'supported' ? right.conditions.sourceIdentity : null,
      },
      observationLayer: {
        left: left.conditions.status === 'supported' ? left.conditions.observationLayer : null,
        right: right.conditions.status === 'supported' ? right.conditions.observationLayer : null,
      },
      bindings: {
        left: left.conditions.status === 'supported' ? left.conditions.bindings : [],
        right: right.conditions.status === 'supported' ? right.conditions.bindings : [],
      },
      unboundConditionalReferences: {
        left:
          left.conditions.status === 'supported'
            ? left.conditions.unboundConditionalReferences
            : {},
        right:
          right.conditions.status === 'supported'
            ? right.conditions.unboundConditionalReferences
            : {},
      },
      sourceExclusions: {
        left: finiteEventSourceExclusions(left.evidence?.result),
        right: finiteEventSourceExclusions(right.evidence?.result),
      },
      blockers: [
        ...(left.conditions.status === 'unsupported' ? left.conditions.blockers : []),
        ...(right.conditions.status === 'unsupported' ? right.conditions.blockers : []),
        ...(left.construction?.status === 'unsupported' ? left.construction.blockers : []),
        ...(right.construction?.status === 'unsupported' ? right.construction.blockers : []),
      ],
    }
  })
  const undeclared = controlledState
    ? standardFiniteEventComparisonPairs.slice(0, 2).map((pair) => {
        const left = evidenceFor(pair.left, pair.subjectAgentId, false)
        const right = evidenceFor(pair.right, pair.subjectAgentId, false)
        const comparison =
          left.evidence && right.evidence ? compare(left.evidence, right.evidence) : null
        return {
          id: pair.id,
          leftStatus: left.evidence?.result.status ?? 'unsupported',
          rightStatus: right.evidence?.result.status ?? 'unsupported',
          relation: comparison?.relation ?? 'incomparable',
          sourceExclusions: {
            left: finiteEventSourceExclusions(left.evidence?.result),
            right: finiteEventSourceExclusions(right.evidence?.result),
          },
        }
      })
    : []
  return {
    contract,
    scenario,
    total: records.length,
    supported: records.filter(
      (record) => record.leftStatus === 'supported' && record.rightStatus === 'supported',
    ).length,
    ordered: records.filter((record) => ['left', 'right'].includes(record.relation)).length,
    records,
    ...(controlledState ? { controlledState, undeclared } : {}),
    boundary:
      'Declared single-event source-window replay only. Values are finite event priorities under the named conditions, not uptime, DPS, Formal strength or global ranking accuracy.',
  }
}

// ranking-output-finalizer:start
/** A supported source settlement can still be inapplicable to the classified
 * ranking coordinate. Preserve the settlement fact; do not expose it as an
 * applicable supported record or change any candidate rank/depth. */
export function finalizeRankingOutput(content) {
  const coordinateByKey = new Map(
    content.rows.map((row) => [
      row
        .slice(0, 3)
        .map((index) => content.agentIds[index])
        .sort()
        .join('|'),
      row[3] === content.statuses.indexOf('ranked') ? content.systems[row[4]] : null,
    ]),
  )
  const mismatches = content.sameCoreOutput.records.filter(
    (record) =>
      record.status === 'supported' &&
      record.outputSystem !== coordinateByKey.get([...record.memberIds].sort().join('|')),
  )
  // A source partial may come from packet/equipment exclusions rather than an
  // unknown effect. The consumer partial contract requires effect keys. Keep
  // that source status visible and fail closed as an unsupported record; do
  // not invent unknown effect keys or promote its settled slice to support.
  const exclusionPartials = content.sameCoreOutput.records.filter(
    (record) => record.status === 'partial' && !record.unknownEffectKeys.length,
  )
  if (!mismatches.length && !exclusionPartials.length) return content
  const before = structuredClone(content.sameCoreOutput.coverage)
  for (const record of mismatches) {
    const system = coordinateByKey.get([...record.memberIds].sort().join('|'))
    record.sourceSettlementStatus = record.status
    record.sourceSettlementFixedEventValue = record.fixedEventValue
    record.status = 'unsupported'
    record.fixedEventValue = null
    record.blockers = [
      `same_core_output_coordinate_not_applicable:${record.outputSystem}->${system}`,
    ]
  }
  for (const record of exclusionPartials) {
    record.sourceSettlementStatus = record.status
    record.sourceSettlementFixedEventValue = record.fixedEventValue
    record.status = 'unsupported'
    record.fixedEventValue = null
    record.blockers = [
      'same_core_partial_status_without_unknown_effect_keys',
      ...(record.sourceExclusions ?? []).map(
        (item) => `source_exclusion:${item.effectKey}:${(item.fields ?? []).join(',')}`,
      ),
    ]
  }
  const coverage = content.sameCoreOutput.coverage
  coverage.supported -= mismatches.length
  coverage.partial -= exclusionPartials.length
  coverage.unsupported += mismatches.length + exclusionPartials.length
  coverage.evaluation.supportedTeams -= mismatches.length
  coverage.evaluation.partialTeams -= exclusionPartials.length
  coverage.evaluation.unsupportedTeams += mismatches.length + exclusionPartials.length
  content.sameCoreOutput.sourceSettlementCoverage = before
  content.sameCoreOutput.applicabilityProjection = {
    contract: 'soda-same-core-coordinate-applicability/v1',
    sourceSupportedButNotApplicable: mismatches.length,
    sourcePartialWithoutEffectKeys: exclusionPartials.length,
    sourceSettlementPreserved: true,
    rankingRowsChanged: false,
  }
  return content
}
// ranking-output-finalizer:end

export async function generateTeamSystemRanking(output = defaultOutput, options = {}) {
  const [index, methodSource, generatorSource, sourceClosure] = await Promise.all([
    readFile(intrinsicIndexUrl, 'utf8').then(JSON.parse),
    readFile(methodUrl, 'utf8'),
    readFile(generatorUrl, 'utf8'),
    collectTeamSystemRankingSourceClosure(methodUrl),
  ])
  if (
    index.contract !== 'soda-current31-team-intrinsic-index/v1' ||
    index.agentIds.length !== 61 ||
    index.rows.length !== 35990
  )
    throw new Error('Intrinsic index is not the current 61-agent full identity domain.')
  const fingerprint = sha256(
    JSON.stringify({
      index: sha256(JSON.stringify(index)),
      sourceClosure: sourceClosure.sha256,
      method: sha256(methodSource),
      generator: sha256(generatorSource),
    }),
  )
  if (options.fingerprint && options.fingerprint !== fingerprint)
    throw new Error('Frozen ranking batch inputs changed; checkpoint cannot be reused.')
  const server = await createServer({
    root,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { extractTeamStrengthMechanicFeatures, teamStrengthMechanicDataFingerprint } =
      await server.ssrLoadModule('/src/decision/teamStrengthMechanicFeatures.ts')
    const { memberFacts } = await server.ssrLoadModule('/src/decision/teamStrengthMemberFacts.ts')
    const { lookupCurrent31TeamIntrinsicDetails } = await server.ssrLoadModule(
      '/src/decision/current31TeamIntrinsicIndex.ts',
    )
    const { currentTeamStrengthReferenceConditions } = await server.ssrLoadModule(
      '/src/decision/teamStrengthReferenceConditions.ts',
    )
    const { resolveTeamStrengthRecipientContext } = await server.ssrLoadModule(
      '/src/decision/teamStrengthSourceCapacity.ts',
    )
    const { resolveReviewedTeamOutputModule } = await server.ssrLoadModule(
      '/src/gameDataPacks/reviewedTeamOutputModuleEvidence.ts',
    )
    const {
      classifyTeamOutputSystem,
      createTeamSystemRankingProfile,
      assignMechanisticSystemRanks,
      compareTeamSystemRankingCandidates,
      compareProfilesForOrder,
      teamSystemRankingMethodContract,
      teamSystemRankingMethodPolicy,
    } = await server.ssrLoadModule('/src/decision/teamSystemRankingMethod.ts')
    const {
      createTeamSameCoreOutputInput,
      projectTeamSameCoreOutput,
      compareTeamSameCoreOutput,
      teamSameCoreOutputComparisonPolicy,
      snapshotTeamSameCoreRanking,
    } = await server.ssrLoadModule('/src/decision/teamSameCoreOutputComparison.ts')
    const {
      createTeamStrengthStandardFiniteEventConditions,
      teamStrengthStandardFiniteEventConditionsContract,
      teamStrengthStandardFiniteEventConditionsScenario,
    } = await server.ssrLoadModule('/src/decision/teamStrengthStandardFiniteEventConditions.ts')
    const { teamStrengthReferenceConditionsIdentity } = await server.ssrLoadModule(
      '/src/decision/teamStrengthReferenceConditions.ts',
    )
    const { teamStrengthSourceCapacityIdentity } = await server.ssrLoadModule(
      '/src/decision/teamStrengthSourceCapacityPolicy.ts',
    )
    const { teamStrengthEquippedReferenceBuildPolicy } = await server.ssrLoadModule(
      '/src/decision/teamStrengthReferenceBuild.ts',
    )
    const { currentNormalizedPlanningBaseline } = await server.ssrLoadModule(
      '/src/calculation/currentNormalizedPlanningBaseline.ts',
    )
    const { reviewedAnomalyPartySource32, reviewedAnomalyPartyStateHash32 } =
      await server.ssrLoadModule('/src/calculation/reviewedAnomalyPartyState32.ts')
    const candidates = []
    const unsupported = []
    const sameCoreRecords = []
    const sourcePins = []
    const sourcePinIndices = new Map()
    const sameCoreEvaluation = {
      evaluated: 0,
      supportedTeams: 0,
      partialTeams: 0,
      unsupportedTeams: 0,
      tracedTeams: 0,
    }
    const sameCoreUnknownEffectCounts = new Map()
    const byAgentIndex = new Map(index.agentIds.map((id, position) => [id, position]))
    const inferStart = options.start ?? 0
    const inferEnd = options.end ?? index.rows.length
    if (options.inferenceOnly)
      for (let ordinal = inferStart; ordinal < inferEnd; ordinal++) {
        const raw = index.rows[ordinal]
        const memberIds = raw.slice(0, 3).map((position) => index.agentIds[position])
        const validity = index.dictionaries.mechanicValidities[raw[7]]
        if (validity === 'invalid') {
          unsupported.push({ ordinal, memberIds, reason: 'invalid_mechanics' })
          continue
        }
        const referenceConditions = currentTeamStrengthReferenceConditions(memberIds)
        const features = extractTeamStrengthMechanicFeatures(
          memberIds,
          resolveTeamStrengthRecipientContext(memberIds, referenceConditions),
          referenceConditions,
        )
        if (!features.eligibility.eligible) {
          const includesPhoenix = memberIds.includes('agent-phoenix')
          unsupported.push({
            ordinal,
            memberIds,
            reason: includesPhoenix
              ? 'member_action_evidence_unavailable'
              : 'mechanic_evidence_missing',
          })
          continue
        }
        if (features.guardrails.noPrimaryOutput) {
          unsupported.push({ ordinal, memberIds, reason: 'no_primary_output' })
          continue
        }
        const reviewedModule = resolveReviewedTeamOutputModule(memberIds)
        const primary = memberFacts(features.primaryOutputAgentId)
        const classification = classifyTeamOutputSystem({
          outputModule: reviewedModule,
          primaryOutputAgentId: features.primaryOutputAgentId,
          primaryOutputSpecialty: primary?.specialty ?? null,
          primaryDamageFormulaFamily: primary?.actionFacts.damage?.formulaFamily ?? null,
          primaryAnomalyBuildup: primary?.actionFacts.anomaly?.anomalyBuildup ?? 0,
          differentAttributeAnomalyPair:
            (featureValue(features, 'different_attribute_anomaly_pair') ?? 0) > 0,
          compatibleAnomalyCapability: featureValue(features, 'compatible_anomaly_capability') ?? 0,
          anomalyProficiencyGain: features.sourceCapacityEvidence?.anomalyProficiencyGain ?? 0,
          anomalyMasteryGain: features.sourceCapacityEvidence?.anomalyMasteryGain ?? 0,
        })
        if (classification.status !== 'classified') {
          unsupported.push({ ordinal, memberIds, reason: classification.reason })
          continue
        }
        const standardConditions = createTeamStrengthStandardFiniteEventConditions({
          memberIds,
          subjectAgentId: features.primaryOutputAgentId,
        })
        const effectiveReferenceConditions =
          standardConditions.status === 'supported'
            ? standardConditions.referenceConditions
            : referenceConditions
        const shouldEvaluateSameCore =
          standardConditions.status === 'supported' ||
          hasDeclaredSupportReferences(effectiveReferenceConditions)
        const sameCore = shouldEvaluateSameCore
          ? (() => {
              const construction = createTeamSameCoreOutputInput({
                memberIds,
                subjectAgentId: features.primaryOutputAgentId,
                referenceConditions: effectiveReferenceConditions,
                baselineReferencesByAgentId:
                  effectiveReferenceConditions.supportReferencesByAgentId ?? {},
              })
              const evidence =
                construction.status === 'ready'
                  ? projectTeamSameCoreOutput(construction.input)
                  : undefined
              sameCoreEvaluation.evaluated += 1
              if (!evidence || evidence.result.status === 'unsupported')
                sameCoreEvaluation.unsupportedTeams += 1
              else if (evidence.result.status === 'partial') {
                sameCoreEvaluation.partialTeams += 1
                for (const unknown of evidence.result.unknownEffects)
                  sameCoreUnknownEffectCounts.set(
                    unknown.effectKey,
                    (sameCoreUnknownEffectCounts.get(unknown.effectKey) ?? 0) + 1,
                  )
              } else sameCoreEvaluation.supportedTeams += 1
              const shouldTrace =
                standardConditions.status === 'supported'
                  ? standardConditions.bindings.length > 0 ||
                    Boolean(effectiveReferenceConditions.phoenixCanonicalEvent33)
                  : hasDeclaredSupportReferences(effectiveReferenceConditions)
              if (shouldTrace) {
                sameCoreEvaluation.tracedTeams += 1
                sameCoreRecords.push(
                  sameCoreRecord({
                    memberIds,
                    subjectAgentId: features.primaryOutputAgentId,
                    referenceConditions: effectiveReferenceConditions,
                    construction,
                    evidence,
                  }),
                )
              }
              return evidence
            })()
          : null
        const profile = createTeamSystemRankingProfile(
          classification.system,
          features,
          sameCore?.input,
          sameCore ?? undefined,
        )
        if (profile.sameCoreOutput) {
          profile.sameCoreComparison = snapshotTeamSameCoreRanking(profile.sameCoreOutput)
          delete profile.sameCoreOutput
        }
        const capacities = [...profile.positiveCapacities, ...profile.executionBurdens]
        if (!capacities.every(Number.isFinite)) {
          unsupported.push({ ordinal, memberIds, reason: 'nonfinite_mechanic_capacity' })
          continue
        }
        const details = lookupCurrent31TeamIntrinsicDetails(memberIds, memberIds.join(':'))
        candidates.push({
          ordinal,
          memberIds,
          system: classification.system,
          basis: classification.basis,
          profile,
          ...(details
            ? {
                mechanicInput: {
                  mechanicRating: details.mechanicRating,
                  featureVector: details.featureVector,
                },
              }
            : {}),
        })
        if ((ordinal + 1) % 5000 === 0)
          console.log(
            JSON.stringify({ phase: 'infer', completed: ordinal + 1, total: index.rows.length }),
          )
      }
    if (options.inferenceOnly) {
      const content = {
        contract: 'soda-ranking-inference-checkpoint/v1',
        fingerprint,
        start: inferStart,
        end: inferEnd,
        candidates,
        unsupported,
        sameCoreRecords,
        sameCoreEvaluation,
        sameCoreUnknownEffectCounts: [...sameCoreUnknownEffectCounts],
      }
      const serialized = JSON.stringify(content)
      await writeFile(output, JSON.stringify({ sha256: sha256(serialized), content }) + '\n')
      console.log(
        JSON.stringify({
          phase: 'infer_batch_complete',
          start: inferStart,
          end: inferEnd,
          candidates: candidates.length,
          unsupported: unsupported.length,
          bytes: Buffer.byteLength(serialized),
          memory: process.memoryUsage(),
        }),
      )
      return
    }
    const checkpointDir =
      process.env.SODA_RANKING_CHECKPOINT_DIR ??
      path.join(resolveBuildStorage().derivedRoot, 'temp', 'team-system-ranking-checkpoints')
    await mkdir(checkpointDir, { recursive: true })
    const batchSize = 1500
    for (let start = 0; start < index.rows.length; start += batchSize) {
      const end = Math.min(index.rows.length, start + batchSize)
      const batchPath = path.join(checkpointDir, `${fingerprint}-${start}-${end}.json`)
      let batch
      try {
        batch = await readRankingCheckpoint(batchPath, { fingerprint, start, end })
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        await new Promise((resolve, reject) => {
          const child = fork(
            fileURLToPath(import.meta.url),
            ['--infer-batch', JSON.stringify({ output: batchPath, start, end, fingerprint })],
            {
              cwd: root,
              execArgv: process.execArgv,
              stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
            },
          )
          child.once('error', reject)
          child.once('exit', (code, signal) =>
            code === 0
              ? resolve()
              : reject(
                  new Error(`Ranking batch ${start}-${end} failed: exit=${code} signal=${signal}`),
                ),
          )
        })
        batch = await readRankingCheckpoint(batchPath, { fingerprint, start, end })
      }
      candidates.push(...batch.candidates)
      unsupported.push(...batch.unsupported)
      for (const record of batch.sameCoreRecords)
        sameCoreRecords.push(encodeRankingSourcePins(record, sourcePins, sourcePinIndices))
      for (const [key, value] of Object.entries(batch.sameCoreEvaluation))
        sameCoreEvaluation[key] += value
      for (const [key, value] of batch.sameCoreUnknownEffectCounts)
        sameCoreUnknownEffectCounts.set(key, (sameCoreUnknownEffectCounts.get(key) ?? 0) + value)
      console.log(
        JSON.stringify({
          phase: 'infer',
          completed: end,
          total: index.rows.length,
          memory: process.memoryUsage(),
        }),
      )
    }
    console.log(
      JSON.stringify({
        phase: 'rank_start',
        candidates: candidates.length,
        memory: process.memoryUsage(),
      }),
    )
    const ranking = assignMechanisticSystemRanks(
      candidates,
      (left, right) =>
        compareTeamSystemRankingCandidates(
          left.profile,
          right.profile,
          left.mechanicInput,
          right.mechanicInput,
        ),
      { sameOwnerOnly: true },
    )
    console.log(
      JSON.stringify({
        phase: 'rank_complete',
        candidates: candidates.length,
        memory: process.memoryUsage(),
      }),
    )
    const replayStart = performance.now()
    const original = replayOriginalSystemRanks(
      candidates,
      (left, right) =>
        compareTeamSystemRankingCandidates(
          left.profile,
          right.profile,
          left.mechanicInput,
          right.mechanicInput,
        ),
      compareProfilesForOrder,
    )
    if (!exactArray(ranking.ranks, original.ranks) || !exactArray(ranking.depths, original.depths))
      throw new Error('Full-domain ranks/depths differ from the original algorithm.')
    await writeFile(
      path.join(checkpointDir, `${fingerprint}-ranks-equivalence.json`),
      JSON.stringify({
        fingerprint,
        candidates: candidates.length,
        total: index.rows.length,
        rankHash: sha256(JSON.stringify(ranking)),
        originalRankHash: sha256(JSON.stringify(original)),
        equal: true,
        elapsedMs: performance.now() - replayStart,
        ranking,
      }) + '\n',
    )
    console.log(
      JSON.stringify({
        phase: 'rank_equivalence',
        candidates: candidates.length,
        equal: true,
        elapsedMs: performance.now() - replayStart,
        memory: process.memoryUsage(),
      }),
    )
    const candidateByOrdinal = new Map(
      candidates.map((candidate, indexPosition) => [
        candidate.ordinal,
        {
          ...candidate,
          systemRank: ranking.ranks[indexPosition],
          mechanismDepth: ranking.depths[indexPosition],
        },
      ]),
    )
    const unsupportedByOrdinal = new Map(unsupported.map((row) => [row.ordinal, row]))
    const rows = index.rows.map((_, ordinal) => {
      const candidate = candidateByOrdinal.get(ordinal)
      const [first, second, third] = candidate?.memberIds.map((id) => byAgentIndex.get(id)) ?? []
      if (candidate)
        return [
          first,
          second,
          third,
          valueIndex(statuses, 'ranked'),
          valueIndex(systems, candidate.system),
          candidate.systemRank,
          candidate.mechanismDepth,
          valueIndex(classificationBases, candidate.basis),
          -1,
        ]
      const missing = unsupportedByOrdinal.get(ordinal)
      const positions = (
        missing?.memberIds ??
        index.rows[ordinal].slice(0, 3).map((position) => index.agentIds[position])
      ).map((id) => byAgentIndex.get(id))
      return [
        positions[0],
        positions[1],
        positions[2],
        valueIndex(statuses, 'unsupported'),
        -1,
        -1,
        -1,
        -1,
        valueIndex(reasons, missing?.reason ?? 'mechanic_evidence_missing'),
      ]
    })
    const systemCoverage = Object.fromEntries(
      systems.map((system) => [
        system,
        candidates.filter((candidate) => candidate.system === system).length,
      ]),
    )
    const reasonCoverage = Object.fromEntries(
      reasons.map((reason) => [reason, unsupported.filter((row) => row.reason === reason).length]),
    )
    const basisCoverage = Object.fromEntries(
      classificationBases.map((basis) => [
        basis,
        candidates.filter((candidate) => candidate.basis === basis).length,
      ]),
    )
    const references = []
    const referenceAuthorities = new Set([
      'strength_gold',
      'variant_reality_profile',
      'single_publisher_tier',
      'local_editorial_estimate',
    ])
    for (const [ordinal, raw] of index.rows.entries()) {
      const band = raw[4] < 0 ? null : index.dictionaries.bands[raw[4]]
      const authority = index.dictionaries.metaAuthorities[raw[9]]
      if (!['S', 'A+', 'A', 'B'].includes(band) || !referenceAuthorities.has(authority)) continue
      const candidate = candidateByOrdinal.get(ordinal)
      if (!candidate) continue
      references.push({
        memberIds: candidate.memberIds,
        band,
        system: candidate.system,
        profile: candidate.profile,
        mechanicInput: candidate.mechanicInput,
      })
    }
    const fixedCounterexamples = fixedCounterexampleCoverage(
      candidates,
      (left, right) =>
        compareTeamSystemRankingCandidates(
          left.profile,
          right.profile,
          left.mechanicInput,
          right.mechanicInput,
        ),
      (pair) =>
        [pair.left, pair.right].map((memberIds) => {
          const standard = createTeamStrengthStandardFiniteEventConditions({
            memberIds,
            subjectAgentId: 'agent-ye-shunguang',
          })
          const referenceConditions =
            standard.status === 'supported'
              ? standard.referenceConditions
              : currentTeamStrengthReferenceConditions(memberIds)
          const construction = createTeamSameCoreOutputInput({
            memberIds,
            subjectAgentId: 'agent-ye-shunguang',
            referenceConditions,
            baselineReferencesByAgentId: referenceConditions.supportReferencesByAgentId ?? {},
          })
          const evidence =
            construction.status === 'ready'
              ? projectTeamSameCoreOutput(construction.input)
              : undefined
          return {
            memberIds,
            subjectAgentId: 'agent-ye-shunguang',
            status: evidence?.result.status ?? 'unsupported',
            eventPacketIdentity: evidence?.eventPacketIdentity ?? null,
            referenceIdentity: referenceConditions.identity,
            referenceStatus: referenceConditions.status,
            conditionBindingIdentity: standard.status === 'supported' ? standard.identity : null,
            conditionBindings: standard.status === 'supported' ? standard.bindings : [],
            declaredReferenceKeys: Object.fromEntries(
              Object.entries(referenceConditions.supportReferencesByAgentId ?? {}).map(
                ([agentId, references]) => [agentId, Object.keys(references).sort()],
              ),
            ),
            unknownEffectKeys:
              evidence?.result.status === 'unsupported'
                ? []
                : [...new Set(evidence.result.unknownEffects.map((row) => row.effectKey))].sort(),
            blockers:
              construction.status === 'unsupported'
                ? construction.blockers
                : evidence?.result.status === 'unsupported'
                  ? evidence.result.blockers
                  : [],
          }
        }),
    )
    const standardFiniteEvent = standardFiniteEventCoverage({
      createConditions: createTeamStrengthStandardFiniteEventConditions,
      createInput: createTeamSameCoreOutputInput,
      project: projectTeamSameCoreOutput,
      compare: compareTeamSameCoreOutput,
      contract: 'soda-team-standard-finite-event-replay/v1',
      scenario: teamStrengthStandardFiniteEventConditionsScenario,
      controlledState: standardFiniteEventControlledState(
        currentNormalizedPlanningBaseline,
        reviewedAnomalyPartySource32,
        reviewedAnomalyPartyStateHash32,
      ),
    })
    const missingSourcePaths = requiredRankingSourcePaths.filter(
      (required) => !sourceClosure.rows.some((row) => row.path === required),
    )
    if (missingSourcePaths.length)
      throw new Error(
        `Ranking source closure is missing required paths: ${missingSourcePaths.join(', ')}`,
      )
    const sameCoreByStatus = Object.fromEntries(
      ['supported', 'partial', 'unsupported'].map((status) => [
        status,
        sameCoreRecords.filter((record) => record.status === status).length,
      ]),
    )
    const content = {
      contract: 'soda-current-team-system-ranking/v3',
      producerProtocol: currentTeamSystemRankingProducerContract,
      gameVersion: index.gameVersion,
      currentIdentity: index.currentIdentity,
      intrinsicIndexContentHash: index.contentHash,
      mechanicDataFingerprint: teamStrengthMechanicDataFingerprint,
      methodContract: teamSystemRankingMethodContract,
      adoptionStatus: teamSystemRankingMethodPolicy.productionEligible
        ? 'production'
        : 'development_candidate',
      productionEligible: teamSystemRankingMethodPolicy.productionEligible,
      agentIds: index.agentIds,
      systems,
      statuses,
      classificationBases,
      reasons,
      rows,
      sameCoreOutput: {
        protocol: currentSystemRankingSameCoreIntegrationContract,
        comparisonContract: teamSameCoreOutputComparisonPolicy.contract,
        productionEligible: teamSameCoreOutputComparisonPolicy.productionEligible,
        conditionPolicy:
          'consume-only-referenceConditions.supportReferencesByAgentId; absent-triggers-remain-unknown; never-default-max-stacks',
        standardConditionIdentity: {
          referenceConditions: teamStrengthReferenceConditionsIdentity,
          sourceCapacity: teamStrengthSourceCapacityIdentity,
          equippedReference: teamStrengthEquippedReferenceBuildPolicy.id,
          baselineId: currentNormalizedPlanningBaseline.baselineId,
          baselineGameVersion: currentNormalizedPlanningBaseline.gameVersion,
          baselineFormulaHash: currentNormalizedPlanningBaseline.formulaHash,
          baselineSourcePackHash: currentNormalizedPlanningBaseline.sourcePackHash,
          finiteEventConditions: teamStrengthStandardFiniteEventConditionsContract,
          finiteEventConditionScenario: teamStrengthStandardFiniteEventConditionsScenario,
          applicableCoordinateContract: teamSystemRankingMethodPolicy.applicableCoordinateContract,
          applicableCoordinateSystems: teamSystemRankingMethodPolicy.applicableCoordinateSystems,
        },
        boundary: teamSameCoreOutputComparisonPolicy.boundary,
        records: sameCoreRecords,
        sourcePinEncoding: { contract: 'soda-ranking-source-pins/v1', entries: sourcePins },
        coverage: {
          declaredTeams: sameCoreRecords.length,
          ...sameCoreByStatus,
          evaluation: sameCoreEvaluation,
        },
        unknownEffectCounts: Object.fromEntries(
          [...sameCoreUnknownEffectCounts].sort(([left], [right]) => left.localeCompare(right)),
        ),
      },
      coverage: {
        total: rows.length,
        ranked: candidates.length,
        unsupported: unsupported.length,
        systems: systemCoverage,
        reasons: reasonCoverage,
        classificationBases: basisCoverage,
      },
      validation: {
        referenceAuthorities: [...referenceAuthorities],
        referenceTeamsWithProfile: references.length,
        withinSystemReferencePairs: profilePairAgreement(
          candidates,
          references,
          { bands: index.dictionaries.bands },
          compareTeamSystemRankingCandidates,
        ),
        fixedCounterexamples,
        standardFiniteEvent,
        boundary:
          'Historical source/editorial bands are retained only as a calibration and counterexample set. They do not enter classification, capacities, dominance or tie resolution; agreement is not independent accuracy. The original nine fixed pairs remain in the replay denominator.',
      },
      inputFingerprints: {
        intrinsicIndex: index.contentHash,
        mechanicData: teamStrengthMechanicDataFingerprint,
        methodContract: teamSystemRankingMethodContract,
        methodSha256: sha256(methodSource),
        generatorSha256: sha256(generatorSource),
        sourceClosureIdentity: sourceClosure.identity,
        sourceClosureSha256: sourceClosure.sha256,
        sourceClosure: sourceClosure.rows,
      },
      boundary:
        'All legal trios are classified from reviewed output modules or positive output-action evidence, or receive an unsupported reason. Ranked teams receive a dense ordinal only when capacity dominance and categorical mechanic dominance agree, inside one primary output system. Same-owner finite event settlement enters only with explicit source triggers and can establish priority only under the joint comparison invariants. Disagreement remains incomparable and no cross-system score or player-facing number is created.',
    }
    finalizeRankingOutput(content)
    const artifact = { ...content, contentHash: stableHash(content) }
    const finalClosure = await collectTeamSystemRankingSourceClosure(methodUrl)
    if (
      finalClosure.sha256 !== sourceClosure.sha256 ||
      sha256(await readFile(generatorUrl, 'utf8')) !== sha256(generatorSource)
    )
      throw new Error('Ranking source changed during production; candidate output is not written.')
    const destination = output instanceof URL ? output : path.resolve(output)
    if (destination instanceof URL)
      await mkdir(path.dirname(fileURLToPath(destination)), { recursive: true })
    else await mkdir(path.dirname(destination), { recursive: true })
    const serialized = `${JSON.stringify(artifact)}\n`
    await writeFile(destination, serialized)
    console.log(
      JSON.stringify({
        output: destination instanceof URL ? fileURLToPath(destination) : destination,
        bytes: Buffer.byteLength(serialized),
        coverage: artifact.coverage,
        validation: artifact.validation,
        contentHash: artifact.contentHash,
      }),
    )
  } finally {
    await server.close()
  }
}

export async function verifyTeamSystemRanking(
  artifactUrl = defaultOutput,
  {
    intrinsicIndexUrl: indexUrl = intrinsicIndexUrl,
    methodUrl: rankingMethodUrl = methodUrl,
    generatorUrl: producerUrl = generatorUrl,
    diagnosticSnapshotOnly = false,
  } = {},
) {
  if (diagnosticSnapshotOnly) {
    const source = (await readFile(artifactUrl, 'utf8')).replaceAll('\r\n', '\n')
    const sha256 = createHash('sha256').update(source).digest('hex')
    // Preserve the fully validated Phase I research artifact at its original scope.
    // The current runtime and its release proof use the separate generic ranking.
    if (sha256 !== 'f9c8602c901b8abee3a4781dfc7ab6fca83f06879119838c5cf869d9f563769e')
      throw new Error('Frozen team system ranking changed; review the diagnostic artifact.')
    const snapshot = JSON.parse(source)
    return {
      pass: true,
      validationScope: 'frozen_diagnostic_integrity',
      currentInputs: false,
      productionConsumer: false,
      contentHash: snapshot.contentHash,
      ranked: snapshot.coverage.ranked,
      unsupported: snapshot.coverage.unsupported,
      systems: snapshot.coverage.systems,
      validation: snapshot.validation,
    }
  }
  const [artifact, index, methodSource, generatorSource, sourceClosure] = await Promise.all([
    readFile(artifactUrl, 'utf8').then(JSON.parse),
    readFile(indexUrl, 'utf8').then(JSON.parse),
    readFile(rankingMethodUrl, 'utf8'),
    readFile(producerUrl, 'utf8'),
    collectTeamSystemRankingSourceClosure(rankingMethodUrl),
  ])
  const server = await createServer({
    root,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  let teamStrengthMechanicDataFingerprint
  let teamSystemRankingMethodContract
  let teamSystemRankingMethodPolicy
  let teamSameCoreOutputComparisonPolicy
  let teamStrengthStandardFiniteEventConditionsContract
  let teamStrengthStandardFiniteEventConditionsScenario
  let expectedControlledState
  try {
    ;({ teamStrengthMechanicDataFingerprint } = await server.ssrLoadModule(
      '/src/decision/teamStrengthMechanicFeatures.ts',
    ))
    ;({ teamSystemRankingMethodContract, teamSystemRankingMethodPolicy } =
      await server.ssrLoadModule('/src/decision/teamSystemRankingMethod.ts'))
    ;({ teamSameCoreOutputComparisonPolicy } = await server.ssrLoadModule(
      '/src/decision/teamSameCoreOutputComparison.ts',
    ))
    ;({
      teamStrengthStandardFiniteEventConditionsContract,
      teamStrengthStandardFiniteEventConditionsScenario,
    } = await server.ssrLoadModule('/src/decision/teamStrengthStandardFiniteEventConditions.ts'))
    const { currentNormalizedPlanningBaseline } = await server.ssrLoadModule(
      '/src/calculation/currentNormalizedPlanningBaseline.ts',
    )
    const { reviewedAnomalyPartySource32, reviewedAnomalyPartyStateHash32 } =
      await server.ssrLoadModule('/src/calculation/reviewedAnomalyPartyState32.ts')
    expectedControlledState = standardFiniteEventControlledState(
      currentNormalizedPlanningBaseline,
      reviewedAnomalyPartySource32,
      reviewedAnomalyPartyStateHash32,
    )
  } finally {
    await server.close()
  }
  if (artifact.contract !== 'soda-current-team-system-ranking/v3')
    throw new Error('Team system ranking contract mismatch.')
  if (artifact.producerProtocol !== currentTeamSystemRankingProducerContract)
    throw new Error('Team system ranking producer protocol mismatch.')
  if (artifact.methodContract !== teamSystemRankingMethodContract)
    throw new Error('Team system ranking method contract mismatch.')
  if (
    artifact.adoptionStatus !==
      (teamSystemRankingMethodPolicy.productionEligible ? 'production' : 'development_candidate') ||
    artifact.productionEligible !== teamSystemRankingMethodPolicy.productionEligible
  )
    throw new Error('Team system ranking candidate authority mismatch.')
  const { contentHash, ...content } = artifact
  if (stableHash(content) !== contentHash)
    throw new Error('Team system ranking content hash mismatch.')
  if (
    artifact.intrinsicIndexContentHash !== index.contentHash ||
    artifact.gameVersion !== index.gameVersion ||
    JSON.stringify(artifact.currentIdentity) !== JSON.stringify(index.currentIdentity) ||
    !exactArray(artifact.agentIds, index.agentIds) ||
    !exactArray(artifact.systems, systems) ||
    !exactArray(artifact.statuses, statuses) ||
    !exactArray(artifact.classificationBases, classificationBases) ||
    !exactArray(artifact.reasons, reasons)
  )
    throw new Error('Team system ranking identity or dictionaries drifted.')
  const fixed = artifact.validation?.fixedCounterexamples
  if (
    fixed?.contract !== 'soda-team-system-ranking-fixed-counterexamples/v1' ||
    fixed.total !== fixedCounterexamplePairs.length ||
    fixed.preserved !== fixedCounterexamplePairs.length ||
    !Array.isArray(fixed.records) ||
    fixed.records.length !== fixedCounterexamplePairs.length ||
    !exactArray(
      fixed.records.map((record) => record.id),
      fixedCounterexamplePairs.map((pair) => pair.id),
    ) ||
    fixed.crossOwnerIncomparable !== 8 ||
    fixed.boundaryViolations !== 0 ||
    fixed.records.filter((record) => record.samePrimaryOutput).length !== 1 ||
    fixed.records.find((record) => record.samePrimaryOutput)?.id !==
      'dialyn-sunna-ye-shunguang__trigger-ye-shunguang-zhao'
  )
    throw new Error('Original nine fixed-pair replay coverage is incomplete.')
  const standardFiniteEvent = artifact.validation?.standardFiniteEvent
  const expectedStandardRelations = new Map([
    ['dialyn-sunna-ye-shunguang__trigger-ye-shunguang-zhao', 'right'],
    ['ye-sunna-billy__ye-zhao-billy', 'right'],
    ['ye-dialyn-billy__ye-trigger-billy', 'left'],
  ])
  if (
    standardFiniteEvent?.contract !== 'soda-team-standard-finite-event-replay/v1' ||
    standardFiniteEvent.scenario !== teamStrengthStandardFiniteEventConditionsScenario ||
    standardFiniteEvent.total !== expectedStandardRelations.size ||
    standardFiniteEvent.supported !== expectedStandardRelations.size ||
    standardFiniteEvent.ordered !== expectedStandardRelations.size ||
    !standardFiniteEvent.controlledState ||
    stableHash(standardFiniteEvent.controlledState) !== stableHash(expectedControlledState) ||
    !Array.isArray(standardFiniteEvent.records) ||
    standardFiniteEvent.records.length !== expectedStandardRelations.size
  )
    throw new Error('Standard finite-event comparison replay is incomplete.')
  const negative = standardFiniteEvent.undeclared
  if (
    !Array.isArray(negative) ||
    negative.length !== 2 ||
    negative.some(
      (record, index) =>
        record.id !== standardFiniteEventComparisonPairs[index].id ||
        record.leftStatus !== 'partial' ||
        record.rightStatus !== 'partial' ||
        record.relation !== 'incomparable' ||
        !record.sourceExclusions?.left?.some((row) =>
          row.fields?.includes('sunnaCatGazeStacks32'),
        ) ||
        !record.sourceExclusions?.right?.some(
          (row) =>
            row.fields?.includes('zhaoM1SwitchedOut32') &&
            row.fields?.includes('zhaoM1SecondsSinceSwitchOut32'),
        ),
    )
  )
    throw new Error('Undeclared finite-event state must remain unknown.')
  for (const record of standardFiniteEvent.records) {
    const expected = expectedStandardRelations.get(record.id)
    if (
      !expected ||
      record.leftStatus !== 'supported' ||
      record.rightStatus !== 'supported' ||
      record.relation !== expected ||
      !Number.isFinite(record.fixedEventDelta) ||
      !record.conditionIdentity.left ||
      !record.conditionIdentity.right ||
      !record.sourceIdentity?.left ||
      !record.sourceIdentity.right ||
      !record.observationLayer?.left ||
      !record.observationLayer.right ||
      !record.bindings.left.length ||
      !record.bindings.right.length
    )
      throw new Error(`Standard finite-event comparison is invalid: ${record.id}`)
  }
  const inputsCurrent = !(
    artifact.mechanicDataFingerprint !== teamStrengthMechanicDataFingerprint ||
    artifact.inputFingerprints?.intrinsicIndex !== index.contentHash ||
    artifact.inputFingerprints?.mechanicData !== teamStrengthMechanicDataFingerprint ||
    artifact.inputFingerprints?.methodContract !== teamSystemRankingMethodContract ||
    artifact.inputFingerprints?.methodSha256 !== sha256(methodSource) ||
    artifact.inputFingerprints?.generatorSha256 !== sha256(generatorSource) ||
    artifact.inputFingerprints?.sourceClosureIdentity !== sourceClosure.identity ||
    artifact.inputFingerprints?.sourceClosureSha256 !== sourceClosure.sha256 ||
    JSON.stringify(artifact.inputFingerprints?.sourceClosure) !== JSON.stringify(sourceClosure.rows)
  )
  if (!inputsCurrent)
    throw new Error('Team system ranking inputs changed; regenerate before use.')
  if (
    artifact.sameCoreOutput?.protocol !== currentSystemRankingSameCoreIntegrationContract ||
    artifact.sameCoreOutput?.comparisonContract !== teamSameCoreOutputComparisonPolicy.contract ||
    artifact.sameCoreOutput?.productionEligible !==
      teamSameCoreOutputComparisonPolicy.productionEligible ||
    artifact.sameCoreOutput?.standardConditionIdentity?.finiteEventConditions !==
      teamStrengthStandardFiniteEventConditionsContract ||
    artifact.sameCoreOutput?.standardConditionIdentity?.finiteEventConditionScenario !==
      teamStrengthStandardFiniteEventConditionsScenario ||
    artifact.sameCoreOutput?.standardConditionIdentity?.applicableCoordinateContract !==
      teamSystemRankingMethodPolicy.applicableCoordinateContract ||
    !exactArray(
      artifact.sameCoreOutput?.standardConditionIdentity?.applicableCoordinateSystems,
      teamSystemRankingMethodPolicy.applicableCoordinateSystems,
    ) ||
    !Array.isArray(artifact.sameCoreOutput?.records) ||
    !artifact.sameCoreOutput?.standardConditionIdentity ||
    !artifact.sameCoreOutput?.boundary
  )
    throw new Error('Team system ranking same-core integration protocol mismatch.')
  const sameCoreIdentities = new Set()
  const sourcePinEncoding = artifact.sameCoreOutput.sourcePinEncoding
  if (sourcePinEncoding) {
    if (
      sourcePinEncoding.contract !== 'soda-ranking-source-pins/v1' ||
      !Array.isArray(sourcePinEncoding.entries) ||
      sourcePinEncoding.entries.some((pin) => typeof pin !== 'string') ||
      new Set(sourcePinEncoding.entries).size !== sourcePinEncoding.entries.length
    )
      throw new Error('Ranking source pin dictionary is invalid.')
    for (const record of artifact.sameCoreOutput.records)
      decodeRankingSourcePins(record, sourcePinEncoding.entries)
  }
  const sameCoreStatusCounts = {
    supported: 0,
    partial: 0,
    unsupported: 0,
  }
  for (const record of artifact.sameCoreOutput.records) {
    if (
      !Array.isArray(record?.memberIds) ||
      record.memberIds.length !== 3 ||
      new Set(record.memberIds).size !== 3 ||
      record.memberIds.some((id) => !artifact.agentIds.includes(id)) ||
      !record.memberIds.includes(record.subjectAgentId) ||
      typeof record.protocol !== 'string' ||
      typeof record.referenceIdentity !== 'string' ||
      typeof record.boundary !== 'string' ||
      !(record.status in sameCoreStatusCounts)
    )
      throw new Error('Team system ranking same-core record is invalid.')
    const key = [...record.memberIds].sort().join('|')
    if (sameCoreIdentities.has(key))
      throw new Error('Team system ranking has duplicate same-core records.')
    sameCoreIdentities.add(key)
    sameCoreStatusCounts[record.status] += 1
    if (
      record.status === 'supported' &&
      (!Number.isFinite(record.fixedEventValue) ||
        record.fixedEventValue <= 0 ||
        !record.eventPacketIdentity ||
        !record.outputSystem ||
        record.unknownEffectKeys.length ||
        record.blockers.length)
    )
      throw new Error('Supported same-core record is incomplete.')
    if (
      record.status === 'partial' &&
      (record.fixedEventValue !== null ||
        !record.unknownEffectKeys.length ||
        record.blockers.length)
    )
      throw new Error('Partial same-core record is not fail-closed.')
    if (
      record.status === 'unsupported' &&
      (record.fixedEventValue !== null || !record.blockers.length)
    )
      throw new Error('Unsupported same-core record is not fail-closed.')
  }
  if (
    artifact.sameCoreOutput.coverage?.declaredTeams !== artifact.sameCoreOutput.records.length ||
    artifact.sameCoreOutput.coverage?.supported !== sameCoreStatusCounts.supported ||
    artifact.sameCoreOutput.coverage?.partial !== sameCoreStatusCounts.partial ||
    artifact.sameCoreOutput.coverage?.unsupported !== sameCoreStatusCounts.unsupported ||
    artifact.sameCoreOutput.coverage?.evaluation?.tracedTeams !==
      artifact.sameCoreOutput.records.length ||
    artifact.sameCoreOutput.coverage?.evaluation?.evaluated !==
      (artifact.sameCoreOutput.coverage?.evaluation?.supportedTeams ?? 0) +
        (artifact.sameCoreOutput.coverage?.evaluation?.partialTeams ?? 0) +
        (artifact.sameCoreOutput.coverage?.evaluation?.unsupportedTeams ?? 0) ||
    !artifact.sameCoreOutput.unknownEffectCounts ||
    Object.values(artifact.sameCoreOutput.unknownEffectCounts).some(
      (count) => !Number.isInteger(count) || count < 0,
    )
  )
    throw new Error('Team system ranking same-core coverage mismatch.')
  const expectedRows =
    (index.agentIds.length * (index.agentIds.length - 1) * (index.agentIds.length - 2)) / 6
  if (!Array.isArray(artifact.rows) || artifact.rows.length !== expectedRows)
    throw new Error('Team system ranking row coverage mismatch.')
  const identities = new Set()
  const systemCounts = Object.fromEntries(systems.map((system) => [system, 0]))
  const reasonCounts = Object.fromEntries(reasons.map((reason) => [reason, 0]))
  const basisCounts = Object.fromEntries(classificationBases.map((basis) => [basis, 0]))
  const depthBySystemRank = new Map()
  let ranked = 0
  let unsupported = 0
  for (const row of artifact.rows) {
    if (!Array.isArray(row) || row.length !== 9 || !row.every(Number.isInteger))
      throw new Error('Team system ranking row shape mismatch.')
    const [first, second, third, statusIndex, systemIndex, rank, score, basisIndex, reasonIndex] =
      row
    if (!(first < second && second < third && third < index.agentIds.length))
      throw new Error('Team system ranking identity mismatch.')
    const key = `${first}:${second}:${third}`
    if (identities.has(key)) throw new Error('Team system ranking has duplicate identities.')
    identities.add(key)
    if (statusIndex === 0) {
      const system = systems[systemIndex]
      const basis = classificationBases[basisIndex]
      if (!system || !basis || rank < 1 || score < 1 || reasonIndex !== -1)
        throw new Error('Ranked team system row has invalid values.')
      ranked += 1
      systemCounts[system] += 1
      basisCounts[basis] += 1
      const rankKey = `${system}:${rank}`
      const existingDepth = depthBySystemRank.get(rankKey)
      if (existingDepth !== undefined && existingDepth !== score)
        throw new Error('A dense system rank contains conflicting dominance depths.')
      depthBySystemRank.set(rankKey, score)
    } else if (statusIndex === 1) {
      if (
        systemIndex !== -1 ||
        rank !== -1 ||
        score !== -1 ||
        basisIndex !== -1 ||
        !reasons[reasonIndex]
      )
        throw new Error('Unsupported team system row has invalid values.')
      unsupported += 1
      reasonCounts[reasons[reasonIndex]] += 1
    } else throw new Error('Unknown team system row status.')
  }
  for (const system of systems) {
    const ranks = [...depthBySystemRank]
      .filter(([key]) => key.startsWith(`${system}:`))
      .map(([key, depth]) => [Number(key.split(':')[1]), depth])
      .sort((left, right) => left[0] - right[0])
    if (!ranks.length) throw new Error(`Team system ranking is empty for ${system}.`)
    if (ranks.some(([rank], indexPosition) => rank !== indexPosition + 1))
      throw new Error(`Team system ranking is not dense for ${system}.`)
    if (
      ranks.some(
        ([, depth], indexPosition) => indexPosition && depth <= ranks[indexPosition - 1][1],
      )
    )
      throw new Error(`Team system ranking dominance depth is not increasing for ${system}.`)
  }
  if (
    artifact.coverage?.total !== expectedRows ||
    artifact.coverage?.ranked !== ranked ||
    artifact.coverage?.unsupported !== unsupported ||
    JSON.stringify(artifact.coverage?.systems) !== JSON.stringify(systemCounts) ||
    JSON.stringify(artifact.coverage?.reasons) !== JSON.stringify(reasonCounts) ||
    JSON.stringify(artifact.coverage?.classificationBases) !== JSON.stringify(basisCounts)
  )
    throw new Error('Team system ranking coverage summary mismatch.')
  const rowByKey = new Map(
    artifact.rows.map((row) => [
      row
        .slice(0, 3)
        .map((index) => artifact.agentIds[index])
        .sort()
        .join('|'),
      row,
    ]),
  )
  for (const record of artifact.sameCoreOutput.records)
    if (record.status === 'supported') {
      const row = rowByKey.get([...record.memberIds].sort().join('|'))
      if (
        !row ||
        artifact.statuses[row[3]] !== 'ranked' ||
        artifact.systems[row[4]] !== record.outputSystem
      )
        throw new Error('Supported same-core output coordinate does not match the consumer row.')
    }
  return {
    pass: true,
    validationScope: 'current_inputs',
    currentInputs: inputsCurrent,
    productionConsumer: true,
    contentHash,
    ranked,
    unsupported,
    systems: systemCounts,
    validation: artifact.validation,
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv[2] === '--infer-batch') {
    const batch = JSON.parse(process.argv[3])
    await generateTeamSystemRanking(batch.output, { ...batch, inferenceOnly: true })
  } else await generateTeamSystemRanking(process.env.SODA_RANKING_OUTPUT ?? defaultOutput)
}
