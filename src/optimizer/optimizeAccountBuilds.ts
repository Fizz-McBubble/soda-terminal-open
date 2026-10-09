import {
  configuredMainStats,
  createAccountOptimizerKnowledge,
  fallbackMainStats,
  generateCandidates,
  toBuildProfile,
  toCandidate,
} from './accountBuildCandidates'
import { overlaps, selectPriorityBuilds } from './selectPriorityAccountBuilds'
export { createAccountOptimizerKnowledge } from './accountBuildCandidates'
import type { DriveDisc } from '../domain/schemas'
import { contentHash } from '../evaluation/contentHash'
import { actualDiscScoreVersion } from './scoreActualDisc'
import type { AgentDiscProfile } from '../assault/engine'
import { optimizeBuild, allowedSetCountPatterns, type CandidatePanelInput } from './optimizeBuild'
import type { RosterAgent } from '../assault/types'
import { currentAgentDirectory } from '../assault/catalog'
import { driveDiscImportSetIdentities } from '../data/gameData'
import {
  teamAssignmentObjectivePolicy,
  type TeamAssignmentObjective,
} from './selectTeamObjectiveAssignment'
import { searchTeamAssignments, type TeamSearchEvidence } from './searchTeamAssignments'
import { isAllowedMainStat } from './buildKnowledge'
import { candidatePanelInputForAgent } from './optimizeAccountBuildsPanelInput'
export { candidatePanelInputForAgent } from './optimizeAccountBuildsPanelInput'
import { dynamicLegalInventory, compileDynamicCandidateLoadout } from './teamDynamicDomain'
import type { AccountBuildResult, UnavailableDiagnosis } from './accountBuildAllocationTypes'
export type {
  AccountBuildResult,
  AccountDiscChoice,
  AccountLoadout,
  UnavailableDiagnosis,
} from './accountBuildAllocationTypes'

export type AccountOptimizerOptions = {
  priorityAgentIds?: string[]
  fixedDiscByAgent?: Record<string, string>
  excludedDiscIds?: string[]
  allowLocked?: boolean
  panelInputsByAgent?: Record<string, CandidatePanelInput>
  teamAssignmentObjective?: TeamAssignmentObjective
  /** Synchronous solve-session cache. The warehouse reference must stay unchanged for its lifetime. */
  candidateGenerationCache?: AccountCandidateGenerationCache
}

type GeneratedCandidates = ReturnType<typeof generateCandidates>

export type AccountCandidateGenerationCache = {
  warehouse: DriveDisc[]
  warehouseHash: string
  entries: Map<string, GeneratedCandidates>
}

export function createAccountCandidateGenerationCache(
  warehouse: DriveDisc[],
): AccountCandidateGenerationCache {
  return { warehouse, warehouseHash: contentHash(warehouse), entries: new Map() }
}

/** Shared by live solving and saved-plan replay; selected scheme engines are not account ownership. */
export function candidatePanelInputsForScheme(
  agents: readonly RosterAgent[],
  memberIds: readonly string[],
  engines: readonly { agentId: string; engineId: string; refinement: number }[] | undefined,
): AccountOptimizerOptions['panelInputsByAgent'] {
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
          ? candidatePanelInputForAgent({
              ...agent,
              wEngineDetails: {
                ...agent.wEngineDetails,
                id: engine.engineId,
                level: 60,
                refinement: engine.refinement,
              },
            })
          : undefined
      return input ? [[agentId, input]] : []
    }),
  )
  return Object.keys(inputs).length ? inputs : undefined
}

export function accountOptimizerInputHash(
  profiles: AgentDiscProfile[],
  options: AccountOptimizerOptions = {},
) {
  return contentHash({
    discScoring: actualDiscScoreVersion,
    allocationPolicy: teamAssignmentObjectivePolicy,
    profiles,
    // Priority is an ordered cultivation queue, not a set. Preserve the player's
    // first-to-last intent in the reproducibility boundary and explanation hash.
    priorityAgentIds: [...(options.priorityAgentIds ?? [])],
    fixedDiscByAgent: Object.fromEntries(Object.entries(options.fixedDiscByAgent ?? {}).sort()),
    excludedDiscIds: [...(options.excludedDiscIds ?? [])].sort(),
    allowLocked: options.allowLocked ?? true,
    panelInputsByAgent: options.panelInputsByAgent,
    ...(options.teamAssignmentObjective
      ? { teamAssignmentObjective: options.teamAssignmentObjective.fingerprint }
      : {}),
  })
}

function cachedCandidates(
  cache: AccountCandidateGenerationCache | undefined,
  discs: DriveDisc[],
  profile: AgentDiscProfile,
  options: Parameters<typeof generateCandidates>[2],
) {
  if (!cache) return generateCandidates(discs, profile, options)
  if (cache.warehouse !== discs) throw new Error('候选生成缓存不属于当前仓库求解。')
  const key = contentHash({
    discScoring: actualDiscScoreVersion,
    profile,
    fixedDiscId: options.fixedDiscId ?? null,
    excludedDiscIds: [...(options.excludedDiscIds ?? [])].sort(),
    allowLocked: options.allowLocked,
    topK: options.topK,
    candidateLimitPerSlot: options.candidateLimitPerSlot ?? null,
    panelInput: options.panelInput ?? null,
  })
  const cached = cache.entries.get(key)
  if (cached) return cached
  const generated = generateCandidates(discs, profile, options)
  cache.entries.set(key, generated)
  return generated
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function diagnoseIndependent(
  discs: DriveDisc[],
  profile: AgentDiscProfile,
  strictCounts: Record<number, number>,
  relaxedCounts: Record<number, number>,
): UnavailableDiagnosis {
  const missingSlots = Array.from({ length: 6 }, (_, index) => index + 1).filter(
    (slot) => (relaxedCounts[slot] ?? 0) === 0,
  )
  const setNames = new Set(
    profile.setPlans?.flatMap((plan) => [...plan.primarySets, ...plan.secondarySets]) ??
      Object.keys(profile.setFit),
  )
  const reasons = missingSlots.map((slot) => {
    const slotDiscs = discs.filter((disc) => disc.slot === slot)
    const setCount = slotDiscs.filter((disc) => setNames.has(disc.setId)).length
    if (!setCount) return `${slot}号位没有该场景允许的套装盘。`
    if (!(strictCounts[slot] ?? 0)) return `${slot}号位推荐主词条与允许套装没有可用组合。`
    return `${slot}号位候选不足以组成完整4+2或2+2+2。`
  })
  if (!missingSlots.length) reasons.push('现有候选无法组成Profile允许的完整4+2或2+2+2。')
  return {
    agentId: profile.agentId,
    scope: 'independent',
    missingSlots,
    reasons,
    actions: ['切换该角色的玩法场景', '补充对应套装/号位库存', '取消冲突的固定或排除条件'],
  }
}

export function optimizeAccountBuilds(
  discs: DriveDisc[],
  profilesInput: AgentDiscProfile[],
  options: AccountOptimizerOptions = {},
): AccountBuildResult {
  const startedAt = performance.now()
  const candidateGenerationCache = options.candidateGenerationCache
  if (candidateGenerationCache) {
    if (candidateGenerationCache.warehouse !== discs)
      throw new Error('候选生成缓存不属于当前仓库求解。')
    if (contentHash(discs) !== candidateGenerationCache.warehouseHash) {
      candidateGenerationCache.entries.clear()
      throw new Error('候选生成缓存创建后仓库内容已变更，请为当前仓库创建新缓存。')
    }
  }
  const solveCache = candidateGenerationCache ?? createAccountCandidateGenerationCache(discs)
  const priorityIds = (options.priorityAgentIds ?? []).filter((id) =>
    profilesInput.some((profile) => profile.agentId === id),
  )
  const excluded = new Set(options.excludedDiscIds ?? [])
  const dynamicDomain = options.teamAssignmentObjective?.domain === 'game_legal_inventory'
  if (dynamicDomain) {
    const legalIds = new Set(dynamicLegalInventory(discs).map((disc) => disc.id))
    for (const disc of discs) if (!legalIds.has(disc.id)) excluded.add(disc.id)
  }
  const fixed = new Map(Object.entries(options.fixedDiscByAgent ?? {}))
  for (const [agentId, discId] of fixed) {
    if (!profilesInput.some((profile) => profile.agentId === agentId))
      throw new Error(`固定盘目标 ${agentId} 不在当前可计算角色中。`)
    if (!discs.some((disc) => disc.id === discId)) throw new Error('固定的驱动盘已不存在。')
    if (options.excludedDiscIds?.includes(discId)) throw new Error('同一张盘不能同时固定和排除。')
    if (excluded.has(discId)) throw new Error('固定盘被排除或不具备可验证的合法强化记录。')
  }
  if (new Set(fixed.values()).size !== fixed.size)
    throw new Error('同一张固定盘不能分配给多个代理人。')

  const fixedOwners = new Map([...fixed].map(([agentId, discId]) => [discId, agentId]))
  const generated = new Map<string, ReturnType<typeof generateCandidates>>()
  for (const profile of profilesInput) {
    const reservedForOthers = new Set(excluded)
    for (const [discId, ownerId] of fixedOwners)
      if (ownerId !== profile.agentId) reservedForOthers.add(discId)
    generated.set(
      profile.agentId,
      cachedCandidates(solveCache, discs, profile, {
        fixedDiscId: fixed.get(profile.agentId),
        excludedDiscIds: reservedForOthers,
        allowLocked: options.allowLocked ?? true,
        topK: 24,
        panelInput: options.panelInputsByAgent?.[profile.agentId],
        warehouseSnapshot: {
          discs: solveCache.warehouse,
          hash: solveCache.warehouseHash,
        },
      }),
    )
  }

  const independent = profilesInput.flatMap(
    (profile) => generated.get(profile.agentId)?.candidates[0] ?? [],
  )
  const candidateMap = new Map(
    profilesInput.map((profile) => [
      profile.agentId,
      generated.get(profile.agentId)?.candidates ?? [],
    ]),
  )
  const global = selectPriorityBuilds(priorityIds, candidateMap)
  const used = new Set(global.flatMap((build) => [...build.discIds]))
  for (const priorityId of priorityIds) {
    if (global.some((build) => build.agentId === priorityId)) continue
    const profile = profilesInput.find((item) => item.agentId === priorityId)!
    const dynamicExcluded = new Set([...excluded, ...used])
    for (const [discId, ownerId] of fixedOwners)
      if (ownerId !== priorityId) dynamicExcluded.add(discId)
    const selected = cachedCandidates(solveCache, discs, profile, {
      fixedDiscId: fixed.get(priorityId),
      excludedDiscIds: dynamicExcluded,
      allowLocked: options.allowLocked ?? true,
      topK: 1,
      candidateLimitPerSlot: 60,
      panelInput: options.panelInputsByAgent?.[profile.agentId],
      warehouseSnapshot: {
        discs: solveCache.warehouse,
        hash: solveCache.warehouseHash,
      },
    }).candidates[0]
    if (!selected) continue
    global.push(selected)
    selected.discIds.forEach((discId) => used.add(discId))
  }
  let teamSearch: TeamSearchEvidence | undefined
  if (
    priorityIds.length === 3 &&
    profilesInput.length === 3 &&
    (options.teamAssignmentObjective || global.length !== 3)
  ) {
    // Generate the complete profile-legal domain even for an unassigned member.
    // Free all provisional owners: rescuing a team may require moving a disc
    // from an already assigned member onto the member omitted by Top-K.
    const domains = priorityIds.map((agentId) => {
      const profile = profilesInput.find((item) => item.agentId === agentId)!
      const seed =
        global.find((item) => item.agentId === agentId) ??
        independent.find((item) => item.agentId === agentId)
      const available = discs.filter(
        (disc) =>
          !excluded.has(disc.id) &&
          (!fixedOwners.has(disc.id) || fixedOwners.get(disc.id) === agentId) &&
          (options.allowLocked !== false || !disc.locked),
      )
      const knowledge = createAccountOptimizerKnowledge(
        profile,
        seed?.degraded ? fallbackMainStats(available, profile) : configuredMainStats(profile),
      )
      const patterns = dynamicDomain ? undefined : allowedSetCountPatterns(knowledge)
      const setIds = new Set(patterns?.flatMap((pattern) => Object.keys(pattern)) ?? [])
      const fixedDisc = available.find((disc) => disc.id === fixed.get(agentId))
      return {
        agentId,
        patterns,
        slots: Array.from({ length: 6 }, (_, index) =>
          available.filter(
            (disc) =>
              disc.slot === index + 1 &&
              (dynamicDomain ||
                (setIds.has(disc.setId) &&
                  isAllowedMainStat(knowledge, disc.slot, disc.mainStat))) &&
              (!fixedDisc || fixedDisc.slot !== disc.slot || fixedDisc.id === disc.id),
          ),
        ),
        compile: (selection: DriveDisc[]) => {
          if (dynamicDomain)
            return compileDynamicCandidateLoadout(
              selection,
              profile,
              options.panelInputsByAgent?.[profile.agentId],
            )
          const build = optimizeBuild(
            selection,
            toBuildProfile(profile),
            knowledge,
            'zzz-drive-disc-3.0-s4.1',
            {
              topK: 1,
              allowLocked: options.allowLocked,
              panelInput: options.panelInputsByAgent?.[profile.agentId],
            },
          ).builds[0]
          return build
            ? toCandidate(build, profile, seed?.degraded ?? false, seed?.degradeReasons ?? [])
            : null
        },
      }
    })
    const dynamicObjective = options.teamAssignmentObjective
    const equipped = dynamicDomain
      ? domains.flatMap((domain) => {
          const ids = options.teamAssignmentObjective?.baselineDiscIdsByAgent?.[domain.agentId]
          if (!ids || ids.length !== 6) return []
          const selection = ids.flatMap(
            (id) => domain.slots.flat().find((disc) => disc.id === id) ?? [],
          )
          const compiled = selection.length === 6 ? domain.compile(selection) : null
          return compiled ? [compiled] : []
        })
      : []
    const sourceSeed =
      dynamicDomain && dynamicObjective?.sourceDiscIdsByAgent
        ? domains.flatMap((domain) => {
            const ids = dynamicObjective.sourceDiscIdsByAgent?.[domain.agentId]
            if (!ids || ids.length !== 6) return []
            const selection = ids.flatMap(
              (id) => domain.slots.flat().find((disc) => disc.id === id) ?? [],
            )
            const compiled = selection.length === 6 ? domain.compile(selection) : null
            return compiled ? [compiled] : []
          })
        : []
    const validSourceSeed =
      sourceSeed.length === 3 &&
      new Set(sourceSeed.flatMap((row) => row.discs.map((item) => item.disc.id))).size === 18
        ? sourceSeed
        : undefined
    const baseline =
      equipped.length === 3 &&
      new Set(equipped.flatMap((row) => row.discs.map((item) => item.disc.id))).size === 18
        ? equipped
        : (validSourceSeed ?? global)
    const seeds = validSourceSeed ? [validSourceSeed] : undefined
    const result = searchTeamAssignments(
      baseline,
      domains,
      options.teamAssignmentObjective,
      undefined,
      seeds,
    )
    teamSearch = result.evidence
    const finalSelected =
      result.evidence.status === 'unsupported' && validSourceSeed
        ? validSourceSeed
        : result.selected
    global.splice(0, global.length, ...finalSelected)
    // A raw-domain result can also recover a personal build discarded before
    // assignment. Its feasible six-disc result supersedes an unavailable flag.
    for (const build of finalSelected) {
      if (!independent.some((item) => item.agentId === build.agentId)) independent.push(build)
    }
    used.clear()
    global.forEach((build) => build.discIds.forEach((id) => used.add(id)))
  }
  const normalProfiles = profilesInput
    .filter((profile) => !priorityIds.includes(profile.agentId))
    .toSorted(
      (left, right) =>
        (candidateMap.get(left.agentId)?.length ?? 0) -
          (candidateMap.get(right.agentId)?.length ?? 0) ||
        left.agentId.localeCompare(right.agentId),
    )
  for (const profile of normalProfiles) {
    let selected = candidateMap
      .get(profile.agentId)
      ?.find((candidate) => !overlaps(candidate, used))
    if (!selected) {
      const dynamicExcluded = new Set([...excluded, ...used])
      for (const [discId, ownerId] of fixedOwners)
        if (ownerId !== profile.agentId) dynamicExcluded.add(discId)
      selected = cachedCandidates(solveCache, discs, profile, {
        fixedDiscId: fixed.get(profile.agentId),
        excludedDiscIds: dynamicExcluded,
        allowLocked: options.allowLocked ?? true,
        topK: 1,
        candidateLimitPerSlot: 60,
        panelInput: options.panelInputsByAgent?.[profile.agentId],
        warehouseSnapshot: {
          discs: solveCache.warehouse,
          hash: solveCache.warehouseHash,
        },
      }).candidates[0]
    }
    if (!selected) continue
    global.push(selected)
    selected.discIds.forEach((discId) => used.add(discId))
  }

  const globalOwner = new Map(
    global.flatMap((loadout) =>
      loadout.discs.map((item) => [item.disc.id, loadout.agentId] as const),
    ),
  )
  const globalByAgent = new Map(global.map((loadout) => [loadout.agentId, loadout]))
  const independentByAgent = new Map(independent.map((loadout) => [loadout.agentId, loadout]))
  const gaps: Record<string, number> = {}
  const conflicts: AccountBuildResult['conflicts'] = {}
  for (const loadout of independent) {
    const assigned = globalByAgent.get(loadout.agentId)
    gaps[loadout.agentId] = round(loadout.totalScore - (assigned?.totalScore ?? 0))
    conflicts[loadout.agentId] = loadout.discs.flatMap((item) => {
      const ownerAgentId = globalOwner.get(item.disc.id)
      return ownerAgentId && ownerAgentId !== loadout.agentId
        ? [{ discId: item.disc.id, ownerAgentId }]
        : []
    })
  }

  const independentUnavailableAgentIds = profilesInput
    .filter((profile) => !independentByAgent.has(profile.agentId))
    .map((profile) => profile.agentId)
  const globalUnavailableAgentIds = profilesInput
    .filter((profile) => !globalByAgent.has(profile.agentId))
    .map((profile) => profile.agentId)
  const shortageReasons = (teamSearch?.shortages ?? []).map((shortage) => {
    const names = shortage.agentIds
      .map((id) => currentAgentDirectory.find((agent) => agent.id === id)?.name ?? id)
      .join('、')
    if (shortage.kind === 'set') {
      const name =
        driveDiscImportSetIdentities.find((set) => set.id === shortage.setId)?.name ??
        shortage.setId
      return `套装数量不足：${names}在所有允许搭配中合计至少需要 ${shortage.required} 张「${name}」，当前符合各自条件的只有 ${shortage.available} 张。`
    }
    return `号位数量不足：${names}的 ${shortage.slot} 号位至少需要 ${shortage.required} 张不同驱动盘，当前符合各自条件的只有 ${shortage.available} 张。`
  })
  const diagnostics: UnavailableDiagnosis[] = profilesInput.flatMap((profile) => {
    if (!independentByAgent.has(profile.agentId)) {
      const evidence = generated.get(profile.agentId)!
      const independentDiagnosis = diagnoseIndependent(
        discs.filter((disc) => !excluded.has(disc.id)),
        profile,
        evidence.strictCandidateCounts,
        evidence.relaxedCandidateCounts,
      )
      return [
        independentDiagnosis,
        {
          ...independentDiagnosis,
          scope: 'global' as const,
          reasons: [
            ...shortageReasons,
            '该角色自身尚无完整合法套装，因此不是被其他角色抢盘导致。',
            ...independentDiagnosis.reasons,
          ],
        },
      ]
    }
    if (!globalByAgent.has(profile.agentId))
      return [
        {
          agentId: profile.agentId,
          scope: 'global' as const,
          missingSlots: [],
          reasons: [
            ...shortageReasons,
            teamSearch?.status === 'budget_exhausted'
              ? '该角色有独立合法配装，但本次联合搜索预算内尚未找到三人互斥配装，不能据此判定库存不足。'
              : teamSearch?.status === 'complete'
                ? '该角色有独立合法配装，但当前套装、主词条与固定/排除条件下，完整搜索未找到三人互斥配装。'
                : '该角色有独立合法配装，但其候选实体盘已被更高优先级或先分配角色占用。',
          ],
          actions: ['设为重点培养后重算', '固定关键盘给该角色', '排除占用冲突较高的角色后重算'],
        },
      ]
    return []
  })

  return {
    independent,
    global,
    gaps,
    conflicts,
    independentUnavailableAgentIds,
    globalUnavailableAgentIds,
    unavailableAgentIds: globalUnavailableAgentIds,
    diagnostics,
    warehouseHash: solveCache.warehouseHash,
    inputHash: accountOptimizerInputHash(profilesInput, options),
    elapsedMs: round(performance.now() - startedAt),
    exactWithinModel: false,
    ...(teamSearch ? { teamSearch } : {}),
    boundary:
      '每名角色先生成满足环境与队伍上下文Profile完整4+2或2+2+2的构筑候选，再进行账号实体盘互斥分配；库存不足时只允许显式标记的主词条降级，不伪装成危局、式舆或精确伤害最优。',
  }
}
