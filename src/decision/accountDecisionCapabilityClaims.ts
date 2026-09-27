import { formalDamageUnsupportedReason } from '../calculation/damageGate'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { commonForbiddenClaims } from './accountDecisionClaimBoundaries'
import type { DecisionClaim } from './accountDecisionService'

export function dataDecisionClaim(): DecisionClaim {
  return {
    status: 'formal',
    summary: `当前目录版本为 ${currentVersionProjection.gameVersion}；字段强度仍按字段级证据分别判断。`,
    allows: ['声明当前安装目录版本与可回滚包身份'],
    forbids: ['不得把 current 目录等同于全部字段 formal'],
    blockers: [],
  }
}

export function formalDamageDecisionClaim(): DecisionClaim {
  const gate = formalDamageUnsupportedReason()
  return {
    status: gate.status === 'calculable' ? 'formal' : 'unsupported',
    summary:
      gate.status === 'calculable'
        ? '完整 CalculationContext 已满足正式计算门。'
        : '当前账户级仓库调度不开放精确伤害或 DPS Claim。',
    allows: gate.status === 'calculable' ? ['在具名 CalculationContext 内复算'] : [],
    forbids: gate.status === 'calculable' ? [] : commonForbiddenClaims,
    blockers: gate.missing.map((item) => item.reason),
  }
}
