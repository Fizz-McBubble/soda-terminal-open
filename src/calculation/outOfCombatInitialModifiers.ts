import { resolvePotentialImage } from '../assault/agentCapabilities'
import { evaluateInitialCritConversion32 } from './currentInitialCritConversion32'
import type { OutOfCombatKey } from './outOfCombatPanel'

type InitialModifier = { key: OutOfCombatKey; value: number; source: string }

/** Static menu modifiers only. Event buffs belong to the separate damage runtime. */
export function projectOutOfCombatInitialModifiers(input: {
  agentId: string
  potentialImage?: number | null
  /** Menu percent units, after unconditional equipment and core stats. */
  critDamage: number
}):
  | { status: 'supported'; modifiers: InitialModifier[] }
  | { status: 'unsupported'; reason: string } {
  const potential = resolvePotentialImage(input.agentId, input.potentialImage)
  if (potential != null && (!Number.isInteger(potential) || potential < 0 || potential > 6))
    return { status: 'unsupported', reason: '潜能必须为 0 到 6 的整数。' }

  const critConversion = evaluateInitialCritConversion32({
    agentId: input.agentId,
    initialStats: { crit_dmg_: input.critDamage / 100 },
  })
  if (critConversion.status === 'unsupported')
    return { status: 'unsupported', reason: critConversion.blockers.join('；') }
  const modifiers: InitialModifier[] = []
  if (critConversion.critRate !== 0)
    modifiers.push({
      key: 'critRate',
      value: critConversion.critRate * 100,
      source: critConversion.sourceRefs.join('|'),
    })

  // Rina P5 with potential enabled still shows 0% PEN in the unequipped game menu.
  // Its 1.6% awakened bonus remains owned by potentialApplicationBinding's combat
  // event projection, rather than being added to the displayed menu a second time.
  return { status: 'supported', modifiers }
}
