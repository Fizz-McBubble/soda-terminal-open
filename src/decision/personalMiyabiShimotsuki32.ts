import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from '../calculation/currentAgentMechanicContracts'
import { resolveSourceEventQuantity32 } from '../calculation/sourceEventQuantity32'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import {
  personalMiyabiShimotsukiDeclarationSchema32,
  type PersonalMiyabiShimotsukiDeclaration32,
} from '../calculation/personalMiyabiShimotsukiDeclaration32'
import { stableContentHash } from '../gameDataPacks/types'

/** One third-charge Shimotsuki slash, not the other charge levels, an
 * anomaly settlement, a resource-generation model, or a combat rotation. */
export function compilePersonalMiyabiShimotsuki32(input: {
  member: PlanningEffectRuntimeMember
  declaration: PersonalMiyabiShimotsukiDeclaration32
}) {
  const parsed = personalMiyabiShimotsukiDeclarationSchema32.safeParse(input.declaration)
  const actor = input.member
  const contract = getCurrentAgentEventContract(actor.agentId)
  const level = actor.skillLevels.basic
  const eventId = 'basic.BasicAttackShimotsuki.hit-2'
  const fail = (...blockers: string[]) => ({ status: 'unsupported' as const, blockers })
  if (!parsed.success) return fail('miyabi_shimotsuki_preparation_invalid')
  if (
    actor.agentId !== 'agent-miyabi' ||
    contract?.identity.attribute !== 'ice' ||
    contract.source.commit !== '3456cd0f6f5bea10e168074502460dac2fcd6df4' ||
    contract.source.formulaSha256 !==
      '7C7E1F1AEDA1D38976D4C0B47C111EB0B4FC76DFE0E6554B567D8260DF8127F3' ||
    contract.source.statsSha256 !==
      '1DBFCDCE806774269DF8E69837308BDAAF547928339EF8BE8425CB34300F4443'
  )
    return fail('miyabi_shimotsuki_source_identity_mismatch')
  if (!Number.isInteger(level) || level! < 1 || level! > 16)
    return fail('miyabi_shimotsuki_basic_level_invalid')
  const event = resolveCurrentAgentEvent({ stableId: actor.agentId, eventId, skillLevel: level! })
  const usage = {
    ownerAgentId: actor.agentId,
    eventId,
    skillLevel: level!,
    occurrenceCount: 1,
    evidenceRefs: [
      ...parsed.data.sourceRefs,
      `${contract.source.formulaPath}#${contract.source.formulaSha256}`,
      `${contract.source.statsPath}#${contract.source.statsSha256}`,
      'GO:char_Miyabi_gen.json#sha256=6699421F2AAD531EF33626EBE15C764DB68D59E251CD205CD7A547E0E775F631#/basic/BasicAttackShimotsuki/params/2; six Fallen Frost consumed for charge level three',
    ],
  }
  if (
    event.status !== 'supported' ||
    event.formulaFamily !== 'standard_direct_damage' ||
    event.scalingAttribute !== 'atk' ||
    event.damageType !== 'basic' ||
    event.formulaProjection !== 'source_registered' ||
    resolveSourceEventQuantity32(usage).status !== 'supported'
  )
    return fail('miyabi_shimotsuki_event_source_mismatch')
  const policyId = 'personal-miyabi-third-charge-shimotsuki-once-v1'
  return {
    status: 'supported' as const,
    policyId,
    identity: stableContentHash({
      policyId,
      declaration: parsed.data,
      source: contract.source,
      eventId,
    }),
    eventUsages: [usage],
    // The M1 DEF-ignore stack is established by the six points consumed in
    // this exact stance. Other temporal states remain undeclared.
    baselineReferences: { fallen_frost: 6 },
    boundary:
      '一次明确准备六点落霜并完整命中的三段蓄力霜月斩击；不含落霜获取、霜灼破、其他动作或频率，不代表全循环。',
  }
}
