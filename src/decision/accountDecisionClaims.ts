import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import type { coordinateMatchedTeams } from '../optimizer/multiTeamCoordinator'
import type { TeamEngineResult } from '../teamEngine/contracts'
import { commonForbiddenClaims } from './accountDecisionClaimBoundaries'
import type { DecisionClaim } from './accountDecisionSnapshotContract'

export function allocationClaim(
  result: AccountBuildResult,
  profileCount: number,
  ownedAgentIds: string[],
  profileAgentIds: string[],
): DecisionClaim {
  const uncoveredAgentIds = ownedAgentIds.filter((agentId) => !profileAgentIds.includes(agentId))
  const blockers = [
    ...result.diagnostics.flatMap((item) => item.reasons),
    ...(uncoveredAgentIds.length
      ? [`${uncoveredAgentIds.length} 名已拥有代理人缺少 current 候选仓库约束。`]
      : []),
  ]
  if (!profileCount)
    return {
      status: 'unsupported',
      summary: '当前账户没有可消费的角色仓库约束，未生成账户级分配。',
      allows: [],
      forbids: commonForbiddenClaims,
      blockers: ['缺少可计算角色 Profile。'],
    }
  return {
    status: 'candidate',
    summary: `已在完整仓库上为 ${result.global.length}/${profileCount} 名可计算角色生成实体盘互斥候选；已拥有角色约束覆盖 ${profileCount}/${ownedAgentIds.length}。`,
    allows: ['比较候选仓库适配分', '解释实体盘冲突、降级与不可用原因'],
    forbids: commonForbiddenClaims,
    blockers,
  }
}

export function teamEngineClaim(result: TeamEngineResult): DecisionClaim {
  if (!result.recommendations.length)
    return {
      status: 'unsupported',
      summary: '当前 BOX 没有通过 Team Engine 机制闭环门的队伍，未生成生产推荐。',
      allows: ['查看具名机制缺口与仅可组成的历史见证'],
      forbids: commonForbiddenClaims,
      blockers: [
        ...new Set([
          ...result.rejected.flatMap((candidate) =>
            candidate.failures.map((failure) => failure.detail),
          ),
          ...(result.assembleOnly.length ? ['旧模板仅证明可组成，不能代替当前版本机制推荐。'] : []),
        ]),
      ],
    }
  return {
    status: 'candidate',
    summary: `Team Engine 已输出 ${result.recommendations.length} 支机制闭环 Candidate；其余 ${result.rejected.length} 支具名拒绝。`,
    allows: ['比较 current strength、机制闭环、BOX 就绪分层与来源 trace'],
    forbids: commonForbiddenClaims,
    blockers: [],
  }
}

export function coordinationClaim(
  result: ReturnType<typeof coordinateMatchedTeams>,
): DecisionClaim {
  return {
    status: result.status === 'ready' ? 'candidate' : 'limited',
    summary:
      result.status === 'ready'
        ? `已形成 ${result.requestedTeamCount} 支来源化互斥队伍候选。`
        : `多队协调仍有 ${result.gaps.length} 项具名缺口。`,
    allows: ['解释成员、邦布、方案引用与实体盘冲突'],
    forbids: commonForbiddenClaims,
    blockers: result.gaps.map((gap) => gap.detail),
  }
}

export function overallClaim(input: {
  allocation: DecisionClaim
  teamEngine: DecisionClaim
  coordination: DecisionClaim
  formalDamage: DecisionClaim
  planningDps: DecisionClaim
}): DecisionClaim {
  if (input.teamEngine.status === 'unsupported' || input.allocation.status === 'unsupported')
    return {
      status: 'unsupported',
      summary: '当前账户决策未同时通过版本化队伍机制与实体盘分配门，结果保持 unsupported。',
      allows: ['查看仓库、培养与机制缺口'],
      forbids: commonForbiddenClaims,
      blockers: [...new Set([...input.teamEngine.blockers, ...input.allocation.blockers])],
    }
  if (input.coordination.status !== 'candidate')
    return {
      status: 'limited',
      summary: '队伍机制已闭环，但多队实体方案或玩家计划尚未闭合。',
      allows: ['查看 Candidate 队伍与具名补全动作'],
      forbids: commonForbiddenClaims,
      blockers: input.coordination.blockers,
    }
  if (input.planningDps.status !== 'candidate')
    return {
      status: 'limited',
      summary: '队伍与实体资产候选已闭合，但 coverage-gated Team Planning DPS 尚未完整。',
      allows: ['查看机制与实体配装 Candidate，以及具名数值覆盖缺口'],
      forbids: commonForbiddenClaims,
      blockers: input.planningDps.blockers,
    }
  return {
    status: 'candidate',
    summary: '当前账户已形成版本化队伍与实体盘互斥 Candidate 决策。',
    allows: ['比较 Candidate 队伍、配装与多队协调结果'],
    forbids: commonForbiddenClaims,
    blockers: input.formalDamage.blockers,
  }
}
