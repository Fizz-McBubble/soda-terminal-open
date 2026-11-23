import rawArtifact from './teamSystemRankingData.mjs'
import { teamPrimaryOutputKindLabels } from '../gameDataPacks/teamOutputModuleContract'
import { stableContentHash } from '../gameDataPacks/types'
import { current31TeamIntrinsicIndexStatus } from './current31TeamIntrinsicIndex'
import {
  teamStrengthStandardFiniteEventConditionsContract,
  teamStrengthStandardFiniteEventConditionsScenario,
} from './teamStrengthStandardFiniteEventConditions'
import { teamStrengthMechanicDataFingerprint } from './teamStrengthMechanicFeatures'
import {
  teamSystemRankingMethodContract,
  teamSystemRankingMethodPolicy,
  type TeamSystemClassificationBasis,
} from './teamSystemRankingMethod'
import { teamSameCoreOutputComparisonPolicy } from './teamSameCoreOutputComparison'
import { teamSameCoreApplicableCoordinatesPolicy } from './teamSameCoreApplicableCoordinates'
import {
  currentTeamSystemRankingContract,
  currentTeamSystemRankingProducerContract,
  currentSystemRankingSameCoreIntegrationContract,
  systems,
  statuses,
  classificationBases,
  rankingReasons,
  requiredSourcePaths,
} from './teamSystemRankingContract'
import type {
  TeamSystemRankingReason,
  SameCoreRecordStatus,
  RawArtifact,
  CurrentTeamSystemRanking,
  PreparedRanking,
} from './teamSystemRankingContract'
export { currentTeamSystemRankingContract } from './teamSystemRankingContract'
export { currentTeamSystemRankingProducerContract } from './teamSystemRankingContract'
export { currentSystemRankingSameCoreIntegrationContract } from './teamSystemRankingContract'
export type { TeamSystemRankingReason } from './teamSystemRankingContract'
export type { CurrentTeamSystemRanking } from './teamSystemRankingContract'

function exactArray(actual: readonly unknown[] | undefined, expected: readonly unknown[]) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  )
}

function sameKeys(actual: unknown, expected: readonly string[]) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false
  const keys = Object.keys(actual).sort()
  return exactArray(keys, [...expected].sort())
}

function validateSourceClosure(artifact: RawArtifact) {
  const rows = artifact.inputFingerprints.sourceClosure
  if (
    !/^[0-9a-f]{64}$/.test(artifact.inputFingerprints.sourceClosureSha256) ||
    !Array.isArray(rows) ||
    rows.some(
      (row) =>
        !row ||
        typeof row.path !== 'string' ||
        !/^src\//.test(row.path) ||
        !/^[0-9a-f]{64}$/.test(row.sha256),
    ) ||
    rows.some((row, index) => index > 0 && !(rows[index - 1]!.path < row.path))
  )
    throw new Error('source closure invalid')
  if (stableContentHash(rows) !== artifact.inputFingerprints.sourceClosureIdentity)
    throw new Error('source closure identity mismatch')
  if (requiredSourcePaths.some((required) => !rows.some((row) => row.path === required)))
    throw new Error('source closure missing required ranking helper')
}

function validateSameCoreOutput(artifact: RawArtifact) {
  const sameCore = artifact.sameCoreOutput
  if (
    sameCore?.protocol !== currentSystemRankingSameCoreIntegrationContract ||
    sameCore.comparisonContract !== teamSameCoreOutputComparisonPolicy.contract ||
    sameCore.productionEligible !== teamSameCoreOutputComparisonPolicy.productionEligible ||
    sameCore.standardConditionIdentity.finiteEventConditions !==
      teamStrengthStandardFiniteEventConditionsContract ||
    sameCore.standardConditionIdentity.finiteEventConditionScenario !==
      teamStrengthStandardFiniteEventConditionsScenario ||
    sameCore.standardConditionIdentity.applicableCoordinateContract !==
      teamSameCoreApplicableCoordinatesPolicy.contract ||
    !exactArray(
      sameCore.standardConditionIdentity.applicableCoordinateSystems as
        | readonly unknown[]
        | undefined,
      teamSameCoreApplicableCoordinatesPolicy.systems,
    ) ||
    typeof sameCore.conditionPolicy !== 'string' ||
    !sameCore.standardConditionIdentity ||
    typeof sameCore.boundary !== 'string' ||
    !sameCore.unknownEffectCounts ||
    typeof sameCore.unknownEffectCounts !== 'object' ||
    !Array.isArray(sameCore.records)
  )
    throw new Error('same-core protocol invalid')
  const identities = new Set<string>()
  const counts: Record<SameCoreRecordStatus, number> = {
    supported: 0,
    partial: 0,
    unsupported: 0,
  }
  for (const record of sameCore.records) {
    if (
      !Array.isArray(record.memberIds) ||
      record.memberIds.length !== 3 ||
      new Set(record.memberIds).size !== 3 ||
      record.memberIds.some((id) => !artifact.agentIds.includes(id)) ||
      !record.memberIds.includes(record.subjectAgentId) ||
      !(record.status in counts) ||
      typeof record.protocol !== 'string' ||
      typeof record.referenceIdentity !== 'string' ||
      typeof record.boundary !== 'string'
    )
      throw new Error('same-core record invalid')
    if (
      record.conditionBindingIdentity !== undefined &&
      record.conditionBindingIdentity !== null &&
      (!/^fnv1a-[0-9a-f]{1,8}$/.test(record.conditionBindingIdentity) ||
        record.conditionBindingScenario !== teamStrengthStandardFiniteEventConditionsScenario ||
        !record.conditionBindingBoundary)
    )
      throw new Error('same-core condition binding invalid')
    const key = [...record.memberIds].sort().join('|')
    if (identities.has(key)) throw new Error('duplicate same-core record')
    identities.add(key)
    counts[record.status] += 1
    if (
      record.status === 'supported' &&
      (!Number.isFinite(record.fixedEventValue) ||
        record.fixedEventValue! <= 0 ||
        !record.eventPacketIdentity ||
        !record.outputSystem ||
        !Array.isArray(record.unknownEffectKeys) ||
        record.unknownEffectKeys.length ||
        !Array.isArray(record.blockers) ||
        record.blockers.length)
    )
      throw new Error('supported same-core record incomplete')
    if (
      record.status === 'partial' &&
      (record.fixedEventValue !== null ||
        !Array.isArray(record.unknownEffectKeys) ||
        !record.unknownEffectKeys.length ||
        !Array.isArray(record.blockers) ||
        record.blockers.length)
    )
      throw new Error('partial same-core record is not fail-closed')
    if (
      record.status === 'unsupported' &&
      (record.fixedEventValue !== null ||
        !Array.isArray(record.blockers) ||
        !record.blockers.length)
    )
      throw new Error('unsupported same-core record is not fail-closed')
  }
  if (
    sameCore.coverage.declaredTeams !== sameCore.records.length ||
    sameCore.coverage.supported !== counts.supported ||
    sameCore.coverage.partial !== counts.partial ||
    sameCore.coverage.unsupported !== counts.unsupported ||
    (sameCore.coverage.evaluation !== undefined &&
      (sameCore.coverage.evaluation.tracedTeams !== sameCore.records.length ||
        sameCore.coverage.evaluation.evaluated !==
          sameCore.coverage.evaluation.supportedTeams +
            sameCore.coverage.evaluation.partialTeams +
            sameCore.coverage.evaluation.unsupportedTeams ||
        sameCore.coverage.evaluation.supportedTeams < counts.supported ||
        sameCore.coverage.evaluation.partialTeams < counts.partial ||
        sameCore.coverage.evaluation.unsupportedTeams < counts.unsupported)) ||
    Object.values(sameCore.unknownEffectCounts).some(
      (count) => !Number.isInteger(count) || count < 0,
    )
  )
    throw new Error('same-core coverage mismatch')
  return new Map(
    sameCore.records.map((record) => [[...record.memberIds].sort().join('|'), record] as const),
  )
}

function prepare(raw: unknown): { ranking: PreparedRanking | null; reason: string | null } {
  try {
    const artifact = raw as RawArtifact
    if (artifact.contract !== currentTeamSystemRankingContract) throw new Error('contract mismatch')
    if (artifact.producerProtocol !== currentTeamSystemRankingProducerContract)
      throw new Error('producer protocol mismatch')
    const { contentHash, ...content } = artifact
    if (stableContentHash(content) !== contentHash) throw new Error('content hash mismatch')
    if (!artifact.productionEligible) throw new Error('ranking production eligibility missing')
    if (artifact.adoptionStatus !== 'production')
      throw new Error('ranking adoption is not production')
    if (!current31TeamIntrinsicIndexStatus.contentHash)
      throw new Error('intrinsic index unavailable')
    if (artifact.intrinsicIndexContentHash !== current31TeamIntrinsicIndexStatus.contentHash)
      throw new Error('intrinsic index identity mismatch')
    if (artifact.mechanicDataFingerprint !== teamStrengthMechanicDataFingerprint)
      throw new Error('mechanic data identity mismatch')
    if (artifact.methodContract !== teamSystemRankingMethodContract)
      throw new Error('ranking method identity mismatch')
    if (
      artifact.inputFingerprints?.intrinsicIndex !== artifact.intrinsicIndexContentHash ||
      artifact.inputFingerprints?.mechanicData !== artifact.mechanicDataFingerprint ||
      artifact.inputFingerprints?.methodContract !== artifact.methodContract
    )
      throw new Error('ranking input identity mismatch')
    validateSourceClosure(artifact)
    const sameCoreByKey = validateSameCoreOutput(artifact)
    const fixed = artifact.validation.fixedCounterexamples
    if (
      fixed?.contract !== 'soda-team-system-ranking-fixed-counterexamples/v1' ||
      fixed.total !== 9 ||
      fixed.preserved !== 9 ||
      fixed.crossOwnerIncomparable !== 8 ||
      fixed.boundaryViolations !== 0 ||
      !Array.isArray(fixed.records) ||
      fixed.records.length !== 9 ||
      fixed.records.filter((record) => record.samePrimaryOutput).length !== 1 ||
      fixed.records.find((record) => record.samePrimaryOutput)?.id !==
        'dialyn-sunna-ye-shunguang__trigger-ye-shunguang-zhao'
    )
      throw new Error('fixed counterexample replay incomplete')
    const standardFiniteEvent = artifact.validation.standardFiniteEvent
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
      typeof standardFiniteEvent.boundary !== 'string' ||
      !Array.isArray(standardFiniteEvent.records) ||
      standardFiniteEvent.records.length !== expectedStandardRelations.size
    )
      throw new Error('standard finite-event replay incomplete')
    for (const record of standardFiniteEvent.records) {
      const expected = expectedStandardRelations.get(record.id ?? '')
      if (
        !expected ||
        record.leftStatus !== 'supported' ||
        record.rightStatus !== 'supported' ||
        record.relation !== expected ||
        !Number.isFinite(record.fixedEventDelta) ||
        !record.conditionIdentity?.left ||
        !record.conditionIdentity.right ||
        !record.sourceIdentity?.left?.planningConditions?.sourceHash ||
        !record.sourceIdentity.right?.planningConditions?.sourceHash ||
        !record.observationLayer?.left?.sourceAuthority ||
        !record.observationLayer.right?.sourceAuthority ||
        !record.bindings?.left?.length ||
        !record.bindings.right?.length ||
        [...(record.bindings.left ?? []), ...(record.bindings.right ?? [])].some(
          (binding) =>
            typeof binding.referenceKey !== 'string' ||
            !Array.isArray(binding.recipientAgentIds) ||
            !binding.recipientAgentIds.length ||
            !Array.isArray(binding.sourceRefs) ||
            !binding.sourceRefs.length,
        )
      )
        throw new Error(`standard finite-event replay invalid: ${record.id}`)
    }
    if (
      !exactArray(artifact.systems, systems) ||
      !exactArray(artifact.statuses, statuses) ||
      !exactArray(artifact.classificationBases, classificationBases) ||
      !exactArray(artifact.reasons, rankingReasons)
    )
      throw new Error('ranking dictionaries invalid')
    if (
      !Array.isArray(artifact.agentIds) ||
      artifact.agentIds.length < 3 ||
      artifact.agentIds.some((id) => typeof id !== 'string') ||
      new Set(artifact.agentIds).size !== artifact.agentIds.length
    )
      throw new Error('agent dictionary invalid')
    const expectedRows =
      (artifact.agentIds.length * (artifact.agentIds.length - 1) * (artifact.agentIds.length - 2)) /
      6
    if (artifact.rows.length !== expectedRows) throw new Error('row coverage mismatch')
    const agentIndex = new Map(artifact.agentIds.map((id, index) => [id, index]))
    const rows = new Map<number, readonly number[]>()
    const identityKeys = new Set<string>()
    const systemCounts = Object.fromEntries(systems.map((system) => [system, 0]))
    const reasonCounts = Object.fromEntries(rankingReasons.map((reason) => [reason, 0]))
    const basisCounts = Object.fromEntries(classificationBases.map((basis) => [basis, 0]))
    const depthBySystemRank = new Map<string, number>()
    let rankedCount = 0
    let unsupportedCount = 0
    for (const row of artifact.rows) {
      if (!Array.isArray(row) || row.length !== 9 || !row.every(Number.isInteger))
        throw new Error('row shape invalid')
      const [first, second, third, statusIndex, systemIndex, rank, score, basisIndex, reasonIndex] =
        row
      if (!(first! < second! && second! < third! && third! < artifact.agentIds.length))
        throw new Error('row identity invalid')
      const identity = `${first}:${second}:${third}`
      if (identityKeys.has(identity)) throw new Error('duplicate row identity')
      identityKeys.add(identity)
      const key =
        first! * artifact.agentIds.length ** 2 + second! * artifact.agentIds.length + third!
      rows.set(key, row)
      if (statusIndex === 0) {
        const system = systems[systemIndex!]
        const basis = classificationBases[basisIndex!]
        if (!system || !basis || rank! < 1 || score! < 1 || reasonIndex !== -1)
          throw new Error('ranked row invalid')
        rankedCount += 1
        systemCounts[system] += 1
        basisCounts[basis] += 1
        const rankKey = `${system}:${rank}`
        const existingDepth = depthBySystemRank.get(rankKey)
        if (existingDepth !== undefined && existingDepth !== score)
          throw new Error('rank depth conflict')
        depthBySystemRank.set(rankKey, score!)
      } else if (statusIndex === 1) {
        const reason = rankingReasons[reasonIndex!]
        if (systemIndex !== -1 || rank !== -1 || score !== -1 || basisIndex !== -1 || !reason)
          throw new Error('unsupported row invalid')
        unsupportedCount += 1
        reasonCounts[reason] += 1
      } else throw new Error('row status invalid')
    }
    for (const record of artifact.sameCoreOutput.records) {
      if (record.status !== 'supported') continue
      const positions = record.memberIds
        .map((id) => agentIndex.get(id))
        .sort((left, right) => left! - right!)
      const [first, second, third] = positions as [number, number, number]
      const recordRow = rows.get(
        first * artifact.agentIds.length ** 2 + second * artifact.agentIds.length + third,
      )
      if (!recordRow || recordRow[3] !== 0 || systems[recordRow[4]!] !== record.outputSystem)
        throw new Error('supported same-core output coordinate mismatch')
    }
    for (const system of systems) {
      const ranks = [...depthBySystemRank]
        .filter(([key]) => key.startsWith(`${system}:`))
        .map(([key, depth]) => [Number(key.split(':')[1]), depth])
        .sort((left, right) => left[0]! - right[0]!)
      if (!ranks.length) throw new Error(`ranking is empty for ${system}`)
      if (ranks.some(([rank], index) => rank !== index + 1))
        throw new Error(`ranking is not dense for ${system}`)
      if (ranks.some(([, depth], index) => index && depth! <= ranks[index - 1]![1]!))
        throw new Error(`ranking depth is not increasing for ${system}`)
    }
    if (
      artifact.coverage?.total !== expectedRows ||
      artifact.coverage?.ranked !== rankedCount ||
      artifact.coverage?.unsupported !== unsupportedCount ||
      !sameKeys(artifact.coverage?.systems, systems) ||
      !sameKeys(artifact.coverage?.reasons, rankingReasons) ||
      !sameKeys(artifact.coverage?.classificationBases, classificationBases) ||
      JSON.stringify(artifact.coverage.systems) !== JSON.stringify(systemCounts) ||
      JSON.stringify(artifact.coverage.reasons) !== JSON.stringify(reasonCounts) ||
      JSON.stringify(artifact.coverage.classificationBases) !== JSON.stringify(basisCounts)
    )
      throw new Error('ranking coverage summary mismatch')
    if (!teamSystemRankingMethodPolicy.productionEligible)
      throw new Error('ranking method is not production eligible')
    return {
      ranking: {
        contentHash,
        agentIds: artifact.agentIds,
        agentIndex,
        rows,
        sameCoreByKey,
        artifact: content,
      },
      reason: null,
    }
  } catch (error) {
    return { ranking: null, reason: error instanceof Error ? error.message : 'unknown error' }
  }
}

function lookupPrepared(
  ranking: PreparedRanking,
  memberIds: readonly string[],
): CurrentTeamSystemRanking | null {
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) return null
  const positions = memberIds
    .map((id) => ranking.agentIndex.get(id))
    .sort((left, right) => left! - right!)
  if (positions.some((position) => position === undefined)) return null
  const [first, second, third] = positions as [number, number, number]
  const row = ranking.rows.get(
    first * ranking.agentIds.length ** 2 + second * ranking.agentIds.length + third,
  )
  if (!row) return null
  const [, , , statusIndex, systemIndex, systemRank, internalScore, basisIndex, reasonIndex] = row
  const common = {
    contract: currentTeamSystemRankingContract,
    rankScope: 'system' as const,
    crossSystemComparable: false as const,
    contentHash: ranking.contentHash,
  }
  if (statusIndex === 1) {
    const reason = ranking.artifact.reasons[reasonIndex!] as TeamSystemRankingReason | undefined
    if (!reason) return null
    return {
      ...common,
      status: 'unsupported',
      system: null,
      systemLabel: null,
      systemRank: null,
      internalScore: null,
      classificationBasis: null,
      reason,
      sameCoreOutput: null,
    }
  }
  const system = ranking.artifact.systems[systemIndex!]
  const classificationBasis = ranking.artifact.classificationBases[basisIndex!] as
    | TeamSystemClassificationBasis
    | undefined
  if (!system || !classificationBasis || systemRank! < 1 || internalScore! < 1) return null
  const sameCore = ranking.sameCoreByKey.get([...memberIds].sort().join('|'))
  return {
    ...common,
    status: 'ranked',
    system,
    systemLabel: teamPrimaryOutputKindLabels[system],
    systemRank: systemRank!,
    internalScore: internalScore!,
    classificationBasis,
    sameCoreOutput: sameCore
      ? {
          status: sameCore.status,
          eventPacketIdentity: sameCore.eventPacketIdentity,
          boundary: sameCore.boundary,
        }
      : null,
  }
}

export function createTeamSystemRankingReader(raw: unknown) {
  const prepared = prepare(raw)
  return {
    status: Object.freeze({
      status: prepared.ranking ? ('ready' as const) : ('unavailable' as const),
      reason: prepared.reason,
      contentHash: prepared.ranking?.contentHash ?? null,
      intrinsicIndexContentHash: prepared.ranking?.artifact.intrinsicIndexContentHash ?? null,
      mechanicDataFingerprint: prepared.ranking?.artifact.mechanicDataFingerprint ?? null,
      methodContract: prepared.ranking?.artifact.methodContract ?? null,
      producerProtocol: prepared.ranking?.artifact.producerProtocol ?? null,
      adoptionStatus: prepared.ranking?.artifact.adoptionStatus ?? null,
      productionEligible: prepared.ranking?.artifact.productionEligible ?? null,
      sameCoreProtocol: prepared.ranking?.artifact.sameCoreOutput.protocol ?? null,
      finiteEventConditionContract: teamStrengthStandardFiniteEventConditionsContract,
      applicableCoordinateContract: teamSameCoreApplicableCoordinatesPolicy.contract,
      sourceClosureIdentity:
        prepared.ranking?.artifact.inputFingerprints.sourceClosureIdentity ?? null,
      coverage: prepared.ranking?.artifact.coverage ?? null,
      boundary:
        'The ordinal is local to one primary output system and requires both capacity dominance and categorical mechanic concordance. It is not a universal score and must not be compared across systems. Same-owner finite-event priority remains conditional on its declared source packet.',
    }),
    lookup(memberIds: readonly string[]) {
      return prepared.ranking ? lookupPrepared(prepared.ranking, memberIds) : null
    },
  }
}

const currentReader = createTeamSystemRankingReader(rawArtifact)

export const currentTeamSystemRankingStatus = currentReader.status

export function lookupCurrentTeamSystemRanking(
  memberIds: readonly string[],
): CurrentTeamSystemRanking | null {
  return currentReader.lookup(memberIds)
}
