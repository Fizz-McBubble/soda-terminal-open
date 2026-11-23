import { z } from 'zod'
import encyclopedia from '../gameDataPacks/data/current-encyclopedia-display.3.3.json'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { applyCurrentAgentResourceTransition32 } from './currentAgentResourceFlow32'
import { reviewedAstraCoreAttackIdentity32 as identity } from './reviewedAstraCoreAttackIdentity32'

const id = z.string().trim().min(1)
const elapsed = z
  .object({
    minimumInclusive: z.number().finite().nonnegative(),
    maximumExclusive: z.number().finite().positive(),
  })
  .strict()
  .refine((v) => v.maximumExclusive > v.minimumInclusive)
const sourceRefs = z.array(id).min(1)
const state = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('no_prior_grant'), sourceRefs }).strict(),
  z
    .object({
      kind: z.literal('single_handoff'),
      incomingAgentId: id,
      entry: z.enum(['quick_assist', 'chain', 'defensive_assist', 'evasive_assist']),
      cadenzaAtTrigger: z.literal(true),
      energyBefore: z.number().finite().nonnegative(),
      elapsedSeconds: elapsed,
      sourceRefs,
    })
    .strict(),
  z
    .object({
      kind: z.literal('single_finale'),
      cadenzaAtTrigger: z.literal(true),
      elapsedSeconds: elapsed,
      sourceRefs,
    })
    .strict(),
])
export type AstraCoreAttackState32 = z.infer<typeof state>

const astra = encyclopedia.agents.find((row) => row.stableId === 'agent-astra')
const currentCore = astra?.core.find((row) => row.level === 7)?.effects[0]?.description ?? ''
const currentChord =
  astra?.skills.flatMap((row) => row.effects).find((row) => row.name === '和弦')?.description ?? ''
const currentFinale =
  astra?.skills.flatMap((row) => row.effects).find((row) => row.name === '普通攻击：终曲')
    ?.description ?? ''
const sourceReady =
  astra?.source.sha256 === identity.currentSourceSha256 &&
  currentCore.includes('耀嘉音和入场角色的攻击力提升') &&
  currentCore.includes('持续20秒') &&
  currentChord.includes('消耗25点能量') &&
  currentFinale.includes('对自身施加')

/** One observed/declared grant, with no preceding unrecorded grants. Repeated
 * refresh/extension is a different ledger: it cannot borrow this 20s window.
 * Energy is charged once per entry, not once per damage row. Cadenza alone is
 * not a core-ATK observation; leaving it does not erase an existing ATK buff. */
export function bindReviewedAstraCoreAttack32(input: {
  memberIds: readonly string[]
  references?: Readonly<Record<string, unknown>>
}) {
  const refs = input.references ?? {}
  const sources = [
    `${identity.currentSourceUrl}#sha256=${identity.currentSourceSha256}`,
    identity.independentSource,
  ]
  const fail = (reason: string) => ({ status: 'unsupported' as const, blockers: [reason] })
  const unknown = () => ({
    status: 'unknown' as const,
    missing: ['astraCoreAttack32'],
    sourceRefs: sources,
  })
  if (
    !sourceReady ||
    getCurrentAgentEventContract('agent-astra')?.source.formulaSha256 !== identity.formulaSha256
  )
    return fail('astra_core_attack_source_changed')
  if (
    !input.memberIds.includes('agent-astra') ||
    new Set(input.memberIds).size !== input.memberIds.length
  )
    return fail('astra_core_attack_formation_invalid')
  if (!Object.hasOwn(refs, 'astraCoreAttack32')) return unknown()
  const parsed = state.safeParse(refs.astraCoreAttack32)
  if (!parsed.success) return fail('astra_core_attack_state_invalid')
  const observation = parsed.data
  const recipients =
    observation.kind === 'single_handoff'
      ? ['agent-astra', observation.incomingAgentId]
      : ['agent-astra']
  if (
    observation.kind === 'single_handoff' &&
    (observation.incomingAgentId === 'agent-astra' ||
      !input.memberIds.includes(observation.incomingAgentId))
  )
    return fail('astra_core_attack_incoming_member_invalid')
  const energy =
    observation.kind === 'single_handoff'
      ? applyCurrentAgentResourceTransition32({
          operation: 'consume',
          amount: identity.energyCost,
          current: observation.energyBefore,
          maximum: Math.max(identity.energyCost, observation.energyBefore),
        })
      : null
  if (energy?.status === 'unsupported') return fail('astra_core_attack_insufficient_energy')
  if (
    observation.kind !== 'no_prior_grant' &&
    observation.elapsedSeconds.minimumInclusive < identity.firstWindowSeconds &&
    observation.elapsedSeconds.maximumExclusive > identity.firstWindowSeconds
  )
    return unknown()
  const active =
    observation.kind !== 'no_prior_grant' &&
    observation.elapsedSeconds.maximumExclusive <= identity.firstWindowSeconds
  return {
    status: 'supported' as const,
    active,
    recipientAgentIds: active ? recipients : [],
    // Reuse the pinned numeric expression; this override is local to core_atk.
    // It does not change the common-DMG/CRIT-DMG Cadenza condition.
    numericGate: active,
    energyTransition: energy,
    sourceRefs: [...sources, ...observation.sourceRefs],
  }
}
