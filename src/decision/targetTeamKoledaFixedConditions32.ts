import {
  koledaFixedEventConditionsContract32,
  koledaFixedEventConditionsInputSchema32,
  type KoledaFixedEventConditionsMetadata32,
} from '../application/publicKoledaFixedEventConditions32'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import type { PlanningEventUsage } from '../calculation/planningCalculationContextCompiler'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import type { PlanningBaseline } from '../calculation/planningDpsContract'
import { isDamageFormula32Version } from '../calculation/sharpDamageCore'
import { reviewedPlanningConditionSemanticsIdentity32 } from '../calculation/reviewedPlanningConditionSemanticsIdentity32'
import { stableContentHash } from '../gameDataPacks/types'

/** Reuses the existing uniform-reference input. It never invents occurrence
 * times, resource balances, inventory stacks, or a complete rotation. */
export function compileTargetTeamKoledaFixedConditions32(input: {
  members: readonly PlanningEffectRuntimeMember[]
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  accountBindingHash: string
  declaration?: unknown
  /** Already compiled from the named finite preparation, never player defaults. */
  preparedReferences32?: Readonly<Record<string, unknown>>
}) {
  if (!isDamageFormula32Version(input.baseline.gameVersion))
    return {
      status: input.declaration === undefined ? ('supported' as const) : ('unsupported' as const),
      metadata: null,
      blockers:
        input.declaration === undefined ? [] : ['珂蕾妲新潜能条件只适用于已采用的3.2公式。'],
      references: undefined,
    }
  const member = input.members.find((row) => row.agentId === 'agent-koleda')
  const source = reviewedPlanningConditionSemanticsIdentity32
  const contract = member ? getCurrentAgentEventContract(member.agentId) : null
  const consumptionEventIds = input.eventUsages
    .filter((usage) => usage.ownerAgentId === 'agent-koleda')
    .filter((usage) => {
      const event = contract?.eventContract.events.find((row) => row.eventId === usage.eventId)
      return event?.eventModifierRefs.some(
        (ref) => ref === 'agent-koleda:basic_dmg_' || ref === 'basic_dmg_',
      )
    })
    .map((usage) => usage.eventId)
    .sort()
  const potentialActive = member?.potential != null && member.potential >= 2
  const metadata: KoledaFixedEventConditionsMetadata32 | null = member
    ? {
        contract: koledaFixedEventConditionsContract32,
        sourceFingerprint: stableContentHash({
          contract: koledaFixedEventConditionsContract32,
          semantics: { commit: source.commit, koleda: source.koleda },
          mappingPolicy: 'uniform-40s-window-consumed-count-0..2-r1',
          accountBindingHash: input.accountBindingHash,
          baseline: input.baseline,
          memberIds: input.members.map((row) => row.agentId),
          eventUsages: input.eventUsages,
          consumptionEventIds,
        }),
        providerAgentId: 'agent-koleda',
        scope: 'all_fixed_events',
        declaredDurationSeconds: input.baseline.declaredDurationSeconds,
        windowDurationSeconds: 40,
        consumptionEventIds,
        requiresWindowState: potentialActive,
        requiresConsumedStackState: potentialActive && consumptionEventIds.length > 0,
      }
    : null
  const blockers: string[] = []
  if (member && contract?.source.commit !== source.commit)
    blockers.push('珂蕾妲固定事件条件与锁定公式来源不一致。')
  if (!metadata && input.declaration !== undefined)
    blockers.push('该队伍没有珂蕾妲，不能采用她的潜能事件条件。')
  let references: Record<string, Record<string, number | boolean>> | undefined
  if (input.declaration !== undefined && metadata) {
    const parsed = koledaFixedEventConditionsInputSchema32.safeParse(input.declaration)
    if (!parsed.success)
      blockers.push(
        ...parsed.error.issues.map(
          (row) =>
            `珂蕾妲固定事件条件无效：${row.path.join('.') || '声明'}:${row.code}${
              row.code === 'unrecognized_keys' ? `:${row.keys.join(',')}` : ''
            }`,
        ),
      )
    else {
      const declaration = parsed.data
      if (declaration.sourceFingerprint !== metadata.sourceFingerprint)
        blockers.push('珂蕾妲的账户、事件或来源已变化，请重新确认潜能条件。')
      if (!declaration.confirmedUniformConditions)
        blockers.push('请明确确认：窗口状态及每次消耗在全部纳入事件中相同。')
      if (metadata.requiresConsumedStackState && declaration.furnaceConsumedStacks32 === undefined)
        blockers.push('增强普攻缺少每次命中实际消耗的炉火层数；库存层数不能替代。')
      if (
        declaration.furnaceConsumptionBuffActive32 &&
        metadata.declaredDurationSeconds > metadata.windowDurationSeconds
      )
        blockers.push('声明时长超出单次40秒窗口；需使用逐次事件条件，不能补造窗口刷新。')
      references = {
        'agent-koleda': {
          furnaceConsumptionBuffActive32: declaration.furnaceConsumptionBuffActive32,
          ...(declaration.furnaceConsumedStacks32 === undefined
            ? {}
            : { furnaceConsumedStacks32: declaration.furnaceConsumedStacks32 }),
        },
      }
    }
  } else if (input.preparedReferences32 && member) {
    const consumed = input.preparedReferences32.furnaceConsumedStacks32
    const window = input.preparedReferences32.furnaceConsumptionBuffActive32
    if (
      !Number.isInteger(consumed) ||
      Number(consumed) < 0 ||
      Number(consumed) > 2 ||
      typeof window !== 'boolean'
    )
      blockers.push('来源准备态的珂蕾妲条件不完整。')
    else
      references = {
        'agent-koleda': {
          furnaceConsumedStacks32: Number(consumed),
          furnaceConsumptionBuffActive32: window,
        },
      }
  } else if (metadata?.requiresWindowState)
    blockers.push('珂蕾妲潜能缺少固定事件的炉火消耗窗口声明，不能默认按未触发计算。')
  if (
    input.preparedReferences32 &&
    references?.['agent-koleda'] &&
    ['furnaceConsumedStacks32', 'furnaceConsumptionBuffActive32'].some(
      (key) => references!['agent-koleda']![key] !== input.preparedReferences32![key],
    )
  )
    blockers.push('保存的珂蕾妲条件与当前来源准备态不一致，请重新分析。')
  return {
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    metadata,
    blockers,
    references,
  }
}
