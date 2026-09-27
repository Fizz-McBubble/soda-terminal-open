import type { PortfolioJointBuildIntent } from '../decision/buildIntent'
import { buildIntentFingerprintMatches } from '../application/publicBuildIntentFingerprint'
import type { TeamExecutionPortfolio } from '../decision/teamExecutionProjection'
import { buildExactTeamPortfolioVariantKey } from './planningSolutionContext'
import { type AccountPlanningDraft } from './types'

export type PortfolioCandidateWarehouse = NonNullable<
  AccountPlanningDraft['candidateWarehouse']
> & {
  scope: 'portfolio'
}

export type TeamPortfolioDiscChoicesSnapshot = NonNullable<
  AccountPlanningDraft['teamPortfolioDiscChoices']
>

export type TeamPortfolioPlanningValidation =
  | {
      valid: true
      teamCount: 2 | 3
      exactAllTeamKey: string
      agentIds: string[]
      discIds: string[]
    }
  | { valid: false; errors: string[] }

export function unique(values: readonly string[]) {
  return [...new Set(values)]
}

export function sameSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value))
}

export function snapshotIdentity(snapshot: TeamExecutionPortfolio) {
  return buildExactTeamPortfolioVariantKey(
    snapshot.executions.map((execution) => ({
      memberIds: execution.memberIds,
      bangbooId: execution.bangbooId,
      bangbooStar: execution.bangbooStar,
      scenario: execution.scenario.identity,
    })),
  )
}

export function teamMemberKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

export function frozenPortfolioBuildIntentValid(
  intent: PortfolioJointBuildIntent | undefined,
  snapshot: TeamExecutionPortfolio,
  agents: readonly string[],
  errors: string[],
) {
  // The field is intentionally absent on snapshots created before the frozen
  // intent existed. They remain structurally recoverable history, while the
  // dedicated freshness reader marks them non-current.
  if (!intent) return
  if (
    intent.contract !== 'soda-build-intent/v1' ||
    intent.scope !== 'portfolio_joint' ||
    intent.resourcePolicy !== 'cross_team_exclusive'
  )
    errors.push('多队草稿冻结的 Build Intent 合同不匹配。')
  if (intent.teamCount !== snapshot.requestedTeamCount)
    errors.push('多队草稿冻结的 Build Intent 队伍数量不匹配。')
  if (!sameSet(intent.agentIds, unique(agents)))
    errors.push('多队草稿冻结的 Build Intent 成员不匹配。')
  if (
    intent.lockedCandidateIds.length !== snapshot.executions.length ||
    !sameSet(
      intent.lockedCandidateIds,
      snapshot.executions.map((execution) => execution.candidateId),
    )
  )
    errors.push('多队草稿冻结的 Build Intent 候选身份不匹配。')
  const resolvedTeams = intent.resolvedTeams
  if (
    !resolvedTeams ||
    resolvedTeams.length !== snapshot.executions.length ||
    !sameSet(
      resolvedTeams.map(teamMemberKey),
      snapshot.executions.map((execution) => teamMemberKey(execution.memberIds)),
    )
  )
    errors.push('多队草稿冻结的 Build Intent 精确队伍不匹配。')
  const potential = intent.agentPotentialById
  if (
    !potential ||
    !sameSet(Object.keys(potential), unique(agents)) ||
    Object.values(potential).some((value) => !Number.isInteger(value) || value < 0)
  )
    errors.push('多队草稿冻结的 Build Intent 缺少已解析的潜能条件。')
  const equipmentParameters = intent.equipmentParametersByCandidateId
  if (equipmentParameters) {
    const executionByCandidateId = new Map(
      snapshot.executions.map((execution) => [execution.candidateId, execution]),
    )
    for (const [candidateId, parameters] of Object.entries(equipmentParameters)) {
      const execution = executionByCandidateId.get(candidateId)
      if (!intent.lockedCandidateIds.includes(candidateId) || !execution) {
        errors.push(`多队草稿冻结的方案参数“${candidateId}”不属于锁定队伍。`)
        continue
      }
      if (
        execution.bangbooId !== parameters.bangbooId ||
        execution.bangbooStar !== parameters.bangbooStars
      )
        errors.push(`多队草稿冻结的方案参数“${candidateId}”与邦布及星级快照不一致。`)
      if (
        parameters.wEngines.length !== execution.memberIds.length ||
        !sameSet(
          parameters.wEngines.map((item) => item.agentId),
          execution.memberIds,
        )
      ) {
        errors.push(`多队草稿冻结的方案参数“${candidateId}”与三名成员不一致。`)
        continue
      }
      const suggestedByAgentId = new Map(
        execution.members.map((member) => [member.agentId, member.suggested.wEngine]),
      )
      for (const wEngine of parameters.wEngines) {
        const suggested = suggestedByAgentId.get(wEngine.agentId)
        if (
          !suggested ||
          suggested.engineId !== wEngine.engineId ||
          suggested.refinement !== wEngine.refinement
        )
          errors.push(`多队草稿冻结的方案参数“${candidateId}”音擎投影不一致。`)
      }
    }
  }
  if (!buildIntentFingerprintMatches(intent))
    errors.push('多队草稿冻结的 Build Intent 指纹不匹配。')
}

export function frozenPortfolioDiscChoicesValid(
  discChoices: TeamPortfolioDiscChoicesSnapshot | undefined,
  agents: readonly string[],
  discIds: readonly string[],
  warehouse: PortfolioCandidateWarehouse | undefined,
  errors: string[],
) {
  // Snapshots created before frozen per-disc score evidence intentionally remain
  // restorable. Their readback adapter reports not_recorded instead of guessing.
  if (!discChoices) return
  if (discChoices.contract !== 'soda-team-portfolio-disc-choices/r1')
    errors.push('多队草稿冻结的实体盘评分合同不匹配。')
  if (discChoices.loadouts.length !== agents.length)
    errors.push('多队草稿冻结的实体盘评分未包含每名成员。')
  const choiceAgents = discChoices.loadouts.map((loadout) => loadout.agentId)
  if (!sameSet(unique(choiceAgents), unique(agents)))
    errors.push('多队草稿冻结的实体盘评分成员不匹配。')
  const choiceDiscIds = discChoices.loadouts.flatMap((loadout) => {
    if (loadout.choices.length !== 6)
      errors.push(`实体盘评分成员“${loadout.agentId}”未形成 6 张盘。`)
    const ids = loadout.choices.map((choice) => choice.discId)
    if (unique(ids).length !== ids.length)
      errors.push(`实体盘评分成员“${loadout.agentId}”含有重复盘。`)
    for (const choice of loadout.choices) {
      if (
        !Number.isFinite(choice.score) ||
        !Number.isFinite(choice.mainStatScore) ||
        !Number.isFinite(choice.subStatScore) ||
        !Number.isInteger(choice.effectiveLines) ||
        choice.effectiveLines < 0 ||
        !Number.isInteger(choice.effectiveRolls) ||
        choice.effectiveRolls < 0 ||
        !Number.isInteger(choice.wastedUpgrades) ||
        choice.wastedUpgrades < 0 ||
        choice.reasons.some((reason) => typeof reason !== 'string')
      )
        errors.push(`实体盘评分“${choice.discId}”的冻结证据无效。`)
    }
    return ids
  })
  if (!sameSet(unique(choiceDiscIds), unique(discIds)) || choiceDiscIds.length !== discIds.length)
    errors.push('多队草稿冻结的实体盘评分与执行快照不一致。')
  if (warehouse) {
    const warehouseByAgent = new Map(
      warehouse.loadouts.map((loadout) => [loadout.agentId, loadout]),
    )
    for (const loadout of discChoices.loadouts) {
      const stored = warehouseByAgent.get(loadout.agentId)
      if (
        !stored ||
        !sameSet(
          loadout.choices.map((choice) => choice.discId),
          stored.discIds,
        )
      )
        errors.push(`实体盘评分成员“${loadout.agentId}”与候选仓库不一致。`)
    }
  }
}

/**
 * Validates the complete resource projection, not merely its portfolio preference.
 * The result is deterministic and read-only, so it is also used for restored drafts.
 */
export function validateTeamPortfolioPlanningDraft(
  draft: Pick<
    AccountPlanningDraft,
    | 'kind'
    | 'selection'
    | 'warehouseRefs'
    | 'candidateWarehouse'
    | 'solutionContext'
    | 'teamPortfolioSnapshot'
    | 'teamPortfolioBuildIntent'
    | 'teamPortfolioDiscChoices'
  >,
): TeamPortfolioPlanningValidation {
  const errors: string[] = []
  const snapshot = draft.teamPortfolioSnapshot
  if (draft.kind !== 'team') errors.push('多队方案必须复用 team 草稿类型。')
  if (!snapshot) errors.push('多队方案缺少完整执行快照。')
  if (!snapshot) return { valid: false, errors }

  const teamCount = snapshot.requestedTeamCount
  if (teamCount !== 2 && teamCount !== 3) errors.push('多队方案仅支持 2 或 3 队。')
  if (snapshot.contract !== 'soda-team-execution/r1') errors.push('多队执行快照合同不受支持。')
  if (snapshot.reusePolicy !== 'simultaneous_lock')
    errors.push('多队执行快照必须使用 simultaneous_lock。')
  if (snapshot.executions.length !== teamCount) errors.push('多队执行快照的队伍数量不完整。')

  const agents = snapshot.executions.flatMap((execution, index) => {
    if (execution.memberIds.length !== 3 || new Set(execution.memberIds).size !== 3)
      errors.push(`第 ${index + 1} 队必须包含三名不同代理人。`)
    if (execution.members.length !== 3) errors.push(`第 ${index + 1} 队缺少完整成员执行投影。`)
    const memberIds = execution.members.map((member) => member.agentId)
    if (!sameSet(memberIds, execution.memberIds))
      errors.push(`第 ${index + 1} 队成员投影与精确队伍不一致。`)
    if (
      execution.deploymentOrder &&
      (execution.deploymentOrder.length !== 3 ||
        new Set(execution.deploymentOrder).size !== 3 ||
        !sameSet(execution.deploymentOrder, execution.memberIds) ||
        !sameSet(execution.deploymentOrder, memberIds))
    )
      errors.push(`第 ${index + 1} 队站位顺序必须恰好包含该队三名不同代理人。`)
    if (
      execution.bangbooStar !== undefined &&
      (!Number.isInteger(execution.bangbooStar) ||
        execution.bangbooStar < 1 ||
        execution.bangbooStar > 5)
    )
      errors.push(`第 ${index + 1} 队邦布星级必须是 1 至 5，或保持未记录。`)
    const suggestedDiscIds = execution.members.flatMap((member) => {
      if (member.suggested.discIds.length !== 6)
        errors.push(`第 ${index + 1} 队成员“${member.agentId}”未形成 6 张实体盘。`)
      return member.suggested.discIds
    })
    if (
      execution.physicalDiscIds.length !== 18 ||
      new Set(execution.physicalDiscIds).size !== 18 ||
      !sameSet(unique(suggestedDiscIds), execution.physicalDiscIds)
    )
      errors.push(`第 ${index + 1} 队必须形成 18 张唯一实体盘。`)
    return execution.memberIds
  })
  const discIds = snapshot.executions.flatMap((execution) => execution.physicalDiscIds)
  const expectedAgentCount = teamCount * 3
  const expectedDiscCount = teamCount * 18
  if (agents.length !== expectedAgentCount || unique(agents).length !== expectedAgentCount)
    errors.push(`多队方案必须包含 ${expectedAgentCount} 名全局唯一代理人。`)
  if (discIds.length !== expectedDiscCount || unique(discIds).length !== expectedDiscCount)
    errors.push(`多队方案必须包含 ${expectedDiscCount} 张全局唯一实体盘。`)
  if (
    snapshot.uniquePhysicalDiscIds.length !== expectedDiscCount ||
    !sameSet(unique(snapshot.uniquePhysicalDiscIds), unique(discIds))
  )
    errors.push('多队执行快照的全局实体盘投影不一致。')

  if (draft.selection.bangbooId !== null) errors.push('多队草稿不能使用单一全局邦布字段。')
  if (!sameSet(draft.selection.agentIds, unique(agents)))
    errors.push('多队草稿成员与执行快照不一致。')
  if (
    !sameSet(unique(draft.warehouseRefs), unique(discIds)) ||
    draft.warehouseRefs.length !== expectedDiscCount
  )
    errors.push('多队草稿的实体盘引用不完整或不唯一。')

  const warehouse = draft.candidateWarehouse
  if (!warehouse || warehouse.scope !== 'portfolio') {
    errors.push('多队草稿缺少 portfolio 范围的候选仓库快照。')
  } else {
    if (warehouse.loadouts.length !== expectedAgentCount)
      errors.push('候选仓库快照未包含每名多队成员。')
    const warehouseAgents = warehouse.loadouts.map((loadout) => loadout.agentId)
    const warehouseDiscIds = warehouse.loadouts.flatMap((loadout) => {
      if (loadout.discIds.length !== 6)
        errors.push(`候选仓库成员“${loadout.agentId}”未形成 6 张盘。`)
      return loadout.discIds
    })
    if (!sameSet(unique(warehouseAgents), unique(agents)))
      errors.push('候选仓库成员与执行快照不一致。')
    if (
      !sameSet(unique(warehouseDiscIds), unique(discIds)) ||
      warehouseDiscIds.length !== expectedDiscCount
    )
      errors.push('候选仓库实体盘与执行快照不一致。')
  }

  const exactAllTeamKey = snapshotIdentity(snapshot)
  frozenPortfolioBuildIntentValid(draft.teamPortfolioBuildIntent, snapshot, agents, errors)
  frozenPortfolioDiscChoicesValid(
    draft.teamPortfolioDiscChoices,
    unique(agents),
    unique(discIds),
    draft.candidateWarehouse as PortfolioCandidateWarehouse | undefined,
    errors,
  )
  const context = draft.solutionContext
  if (
    !context ||
    context.contract !== 'soda-solution-context/v1' ||
    context.scope !== 'portfolio_joint' ||
    context.resourcePolicy !== 'cross_team_exclusive'
  )
    errors.push('多队草稿缺少 portfolio_joint 的跨队求解上下文。')
  else {
    if (!context.inputFingerprint.trim()) errors.push('多队草稿缺少输入指纹。')
    if (context.exactVariantKey !== exactAllTeamKey) errors.push('多队草稿的精确全队 key 不一致。')
  }

  return errors.length
    ? { valid: false, errors: unique(errors) }
    : {
        valid: true,
        teamCount: teamCount as 2 | 3,
        exactAllTeamKey,
        agentIds: unique(agents).sort(),
        discIds: unique(discIds).sort(),
      }
}
