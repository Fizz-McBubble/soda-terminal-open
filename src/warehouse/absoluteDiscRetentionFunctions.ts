import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import {
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from '../calculation/currentUpstreamExpressionIR'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { currentDriveDiscFormulaCatalog } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import type { Profile } from './absoluteDiscRetentionContract'
import { getCandidatePanelPolicy } from '../gameDataPacks/candidatePanelPolicy'

const mainByInput: Record<string, string> = {
  atk: 'atk_percent',
  hp: 'hp_percent',
  def: 'def_percent',
  crit_: 'crit_rate',
  crit_dmg_: 'crit_dmg',
  anomProf: 'anomaly_proficiency',
  anomMas: 'anomaly_mastery',
  impact: 'impact',
  enerRegen: 'energy_regen',
  pen_: 'pen_ratio',
}

function unconditionalShieldQuantity(node: UpstreamExpressionIR): boolean {
  if (node.kind === 'literal') return typeof node.value === 'number' && node.value >= 0
  if (node.kind === 'reference')
    return /^(?:own\.(?:initial|final)\.|char\.core$|dm\.core\.)/.test(node.path)
  return (
    node.kind === 'call' &&
    ['sum', 'prod', 'percent', 'subscript'].includes(node.operator) &&
    node.arguments.every(unconditionalShieldQuantity)
  )
}

/** Only value inputs count. An effect's receiver is its output, not a scaling input. */
export function ownStatInputs(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  const value = node as Record<string, unknown>
  const match =
    value.kind === 'reference' && typeof value.path === 'string'
      ? /^own\.(?:initial|final)\.([\w]+)$/.exec(value.path)
      : null
  return [
    ...(match && mainByInput[match[1]!] ? [mainByInput[match[1]!]!] : []),
    ...Object.values(value).flatMap((child) =>
      Array.isArray(child) ? child.flatMap(ownStatInputs) : ownStatInputs(child),
    ),
  ]
}

export function sourcedFunctionalMains(
  constraint: CandidateWarehouseConstraint,
  agentId: string,
  fourPieceIds: readonly string[],
  guideSourceId: string,
  goal: Profile['goal'] = 'unknown',
): NonNullable<Profile['functionalMains']> {
  // These main-only stats provide tempo / buildup functions independently of substat rolls.
  const functionSources = new Map(
    ['energy_regen', 'impact', 'anomaly_mastery'].map((stat) => [stat, guideSourceId]),
  )
  const shieldMains = new Set<string>()
  const uncappedShieldMains = new Set<string>()
  const contract = getCurrentAgentDecisionMechanicContract(agentId)
  for (const input of contract?.effectContract.functionalInputs ?? []) {
    const expression = input.numericExpression
    if (
      input.kind !== 'shield' ||
      expression.classification !== 'upstream_expression_available' ||
      !expression.expressionIrReady ||
      expression.todoFlagged
    )
      continue
    // Shield quantities are value expressions, not buff receivers. Their owner
    // inputs must be consumed alongside the ordinary effect expressions.
    const value = expression.expressionIr as UpstreamExpressionIR
    for (const stat of ownStatInputs(value)) {
      if (!functionSources.has(stat))
        functionSources.set(
          stat,
          `mechanic-function:${agentId}:${input.inputId}:${expression.expressionSha256}`,
        )
      shieldMains.add(stat)
      if (unconditionalShieldQuantity(value)) uncappedShieldMains.add(stat)
    }
  }
  for (const effect of contract?.effectContract.effects ?? []) {
    const expression = effect.numericExpression
    if (!expression.expressionIrReady || expression.todoFlagged) continue
    // Ordinary damage scaling is scored as quality, not permanent function protection.
    if (goal !== 'functional' && effect.recipients.every((recipient) => recipient === 'self'))
      continue
    const value = extractUpstreamEffectValueIr(expression.expressionIr as UpstreamExpressionIR)
    if (value.status !== 'supported') continue
    for (const stat of ownStatInputs(value.value)) {
      if (functionSources.has(stat)) continue
      functionSources.set(
        stat,
        `mechanic-effect:${agentId}:${effect.effectId}:${expression.expressionSha256}`,
      )
    }
  }
  // This branch's four-piece team buff has an explicit 50% crit-rate threshold.
  // A matching two-piece disc can supply the main while the four other slots supply the set.
  if (fourPieceIds.includes('set-king-of-the-summit')) {
    const set = currentDriveDiscFormulaCatalog.items.find(
      (item) => item.stableId === 'set-king-of-the-summit',
    )
    if (set)
      functionSources.set(
        'crit_rate',
        `${currentDriveDiscFormulaCatalog.generatedFrom.repository}:${currentDriveDiscFormulaCatalog.generatedFrom.commit}:${set.gameId}:four-piece-crit-threshold`,
      )
  }
  if (fourPieceIds.includes('set-34200'))
    functionSources.set(
      'def_percent',
      `${currentDriveDiscFormulaCatalog.generatedFrom.commit}:34200:initial-defense-threshold`,
    )
  const panel = getCandidatePanelPolicy(agentId)
  return (['4', '5', '6'] as const).flatMap((slot) =>
    (constraint.mainStats[slot] ?? []).flatMap((stat) => {
      const sourceId = functionSources.get(stat)
      const mainOnly =
        ['energy_regen', 'impact', 'anomaly_mastery'].includes(stat) ||
        uncappedShieldMains.has(stat)
      const potential = sourceId?.match(/:m([1-6])(?:_|:)/)?.[1]
      const detail = shieldMains.has(stat)
        ? uncappedShieldMains.has(stat)
          ? '满级主词能增加护盾生成量；不代表当前持盾状态或整队覆盖。'
          : '主词用于提高护盾生成量；核对整套配装是否已达到护盾上限。'
        : mainOnly
          ? `满级 ${stat} 主词提供已验证的回复/积蓄功能；不宣称单盘保证整队循环。`
          : stat === 'crit_rate' && fourPieceIds.includes('set-king-of-the-summit')
            ? '核对完整配装中的暴击率达到 50%；一张暴击主词盘不保证四件套门槛。'
            : stat === 'def_percent' && fourPieceIds.includes('set-34200')
              ? '核对四件套的初始防御 1000 / 1800 门槛；战斗中防御增益不替代初始面板。'
              : stat === 'atk_percent' && panel
                ? `核对完整面板攻击力 ${panel.minimumAttack}、核心技等级${panel.requiredCoreLevel ?? '按机制'}及所需套装前提。`
                : `${potential ? `需要潜影 ${potential}，并` : ''}在完整配装中核对 ${stat} 对来源机制的实际贡献与目标；单盘主词不能证明整套功能完成。`
      return sourceId
        ? [
            {
              slot: Number(slot),
              stat,
              sourceId,
              completion: mainOnly ? ('main_only' as const) : ('build_threshold' as const),
              predicateId: `${agentId}:functional:${stat}`,
              detail,
            },
          ]
        : []
    }),
  )
}
