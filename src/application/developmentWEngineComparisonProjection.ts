import {
  projectDevelopmentWEngineValueBenchmarks,
  type DevelopmentValueBenchmarkEvaluator,
} from '../decision/developmentValueBenchmark'
import { resolveWEngine, type LegalWEngineCandidate } from '../decision/wEngineResolver'
import { stableContentHash } from '../gameDataPacks/types'
import { contentHash } from './contentHash'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
import type { DevelopmentCandidateAlternativesQuery } from './calculationQueryContract'
import type {
  DevelopmentWEngineComparisonDto,
  DevelopmentWEngineOption,
} from './publicDevelopmentWEngineComparison'

function option(
  candidate: LegalWEngineCandidate,
  mode?: 'account_owned_if_available' | 'theoretical_benchmark_only',
): DevelopmentWEngineOption {
  const theoretical = mode === 'theoretical_benchmark_only' || !candidate.owned
  const level = theoretical ? 60 : candidate.level
  const refinement = theoretical ? (candidate.rarity === 'S' ? 1 : 5) : candidate.refinement
  const ascension = theoretical ? 5 : candidate.ascension
  const complete =
    typeof level === 'number' &&
    Number.isInteger(level) &&
    level >= 1 &&
    level <= 60 &&
    typeof refinement === 'number' &&
    Number.isInteger(refinement) &&
    refinement >= 1 &&
    refinement <= 5 &&
    typeof ascension === 'number' &&
    Number.isInteger(ascension) &&
    ascension >= 0 &&
    ascension <= 5
  const isCurrent =
    candidate.source === 'agent_current_fact' || candidate.source === 'legacy_copy_compat'
  const progression = theoretical
    ? 'theoretical'
    : isCurrent
      ? 'current'
      : complete
        ? 'owned'
        : 'unknown'
  return {
    engineId: candidate.engineId,
    name: candidate.name,
    owned: candidate.owned,
    isCurrent,
    progression,
    level: level ?? null,
    ascension: ascension ?? null,
    refinement: refinement ?? null,
    passiveCompatibility: candidate.passiveCompatibility,
    optionKey: stableContentHash([
      candidate.engineId,
      candidate.copyIdentity ?? candidate.source,
      progression,
      level,
      ascension,
      refinement,
    ]),
    label: `${candidate.name} · ${progression === 'theoretical' ? '理论参考' : isCurrent ? '当前实装' : candidate.owned ? '已持有' : '未持有'} · ${level == null ? '等级未录入' : `Lv.${level}`} / ${ascension == null ? '突破未录入' : `突破${ascension}`} / ${refinement == null ? '精炼未录入' : `P${refinement}`}${candidate.passiveCompatibility === 'mismatched' ? ' · 被动不生效' : ''}`,
    ...(complete
      ? { parameters: { engineId: candidate.engineId, level, ascension, refinement } }
      : {}),
  }
}

export function projectDevelopmentWEngineOptions(
  warehouse: CoreWarehouse,
  agentId: string,
): DevelopmentWEngineOption[] {
  const agent = warehouse.roster.agents.find((row) => row.agentId === agentId)
  const resolution = resolveWEngine({
    agent,
    roster: warehouse.roster,
    legacyWEngines: warehouse.roster.wEngines,
  })
  return (resolution.legalCandidates ?? []).map((candidate) => option(candidate))
}

/** Exact captured six discs, not another warehouse search per engine. A caller
 * opts in only while using the existing detailed comparison workflow. */
export function projectDevelopmentWEngineComparison(input: {
  warehouse: CoreWarehouse
  agentId: string
  inputFingerprint: string
  discs: readonly DriveDisc[]
  query: DevelopmentCandidateAlternativesQuery
  evaluator: DevelopmentValueBenchmarkEvaluator
}): DevelopmentWEngineComparisonDto | undefined {
  const selection = input.query.wEngineComparison
  if (!selection) return undefined
  if (
    selection.inputFingerprint !== input.inputFingerprint ||
    selection.loadoutFingerprint !== contentHash(input.discs)
  )
    throw new Error('音擎比较对应的账户或六盘方案已变化，请重新比较。')
  const result = projectDevelopmentWEngineValueBenchmarks(
    {
      warehouse: input.warehouse,
      agentId: input.agentId,
      discs: input.discs,
      stale: false,
      progressionMode: selection.progressionMode,
      scenarioSelection: input.query.scenarioSelection,
      eventConditionDeclaration: input.query.eventConditionDeclarationsByAgentId?.[input.agentId],
      resourceGrantDeclaration32: input.query.resourceGrantDeclaration32,
      parameters: input.query.candidateParametersByRank?.[selection.candidateRank],
    },
    input.evaluator,
  )
  const entries = result.entries.map(
    (entry): DevelopmentWEngineComparisonDto['entries'][number] => {
      const candidate = entry.candidate as LegalWEngineCandidate
      const facts = option(candidate, selection.progressionMode)
      const side = entry.benchmark.candidate
      const anomaly = side.coverage?.domain === 'prepared_anomaly_settlement'
      const metric =
        side.state === 'supported'
          ? anomaly
            ? ('prepared_anomaly_damage' as const)
            : ('fixed_event_planning_dps' as const)
          : null
      const value =
        metric === 'prepared_anomaly_damage'
          ? side.totalDamage
          : metric === 'fixed_event_planning_dps'
            ? side.planningDps
            : null
      const fullyBound =
        side.state === 'supported' &&
        side.calculationFingerprint &&
        side.coverage &&
        side.coverage.excludedEffects.every((effect) => effect.resolvedInactive === true) &&
        value !== null &&
        Number.isFinite(value)
      const group = fullyBound
        ? stableContentHash({
            producerGroup: entry.comparableGroupIdentity,
            dimensions: Object.fromEntries(
              Object.entries(side.dimensions).filter(([key]) => key !== 'w_engine'),
            ),
            domain: side.coverage!.domain,
            progression: facts.progression === 'theoretical' ? 'theoretical' : 'account',
            passiveState: entry.passiveState,
          })
        : null
      const comparable =
        result.currentEngineRecorded &&
        entry.benchmark.status === 'supported' &&
        entry.benchmark.comparable &&
        entry.benchmark.coverage.generalConclusion === 'supported'
      return {
        ...facts,
        status: entry.status,
        passiveState: entry.passiveState,
        partialOrderTier: entry.partialOrderTier,
        metric,
        value: value !== null && Number.isFinite(value) ? value : null,
        delta: comparable
          ? anomaly
            ? entry.benchmark.totalDamageDelta
            : entry.benchmark.planningDpsDelta
          : null,
        percentDelta: comparable
          ? anomaly
            ? entry.benchmark.totalDamagePercentDelta
            : entry.benchmark.planningDpsPercentDelta
          : null,
        comparableWithCurrent: comparable,
        comparisonGroupId: group,
        rankWithinGroup: null,
        reasons: [...new Set([...entry.tradeoffs, ...side.reasons, ...entry.benchmark.reasons])],
      }
    },
  )
  const groups = new Map<string, typeof entries>()
  entries.forEach((entry, index) => {
    const key = entry.comparisonGroupId ?? `unranked:${index}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  })
  const ranked = [...groups.values()].flatMap((rows) =>
    rows[0]!.comparisonGroupId
      ? rows
          .toSorted((a, b) => b.value! - a.value! || a.engineId.localeCompare(b.engineId))
          .map((row, index) => ({ ...row, rankWithinGroup: index + 1 }))
      : rows,
  )
  const projection = {
    contract: 'soda-development-w-engine-options/v1' as const,
    candidateRank: selection.candidateRank,
    inputFingerprint: input.inputFingerprint,
    loadoutFingerprint: selection.loadoutFingerprint,
    currentEngineRecorded: result.currentEngineRecorded,
    entries: ranked,
  }
  return { ...projection, fingerprint: stableContentHash(projection) }
}
