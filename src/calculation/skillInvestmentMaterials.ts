import sourceData from './skillInvestmentMaterials32.data.json'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import type { SkillKey } from './skillInvestmentPolicy'

type MaterialRow = Record<string, number>
type MaterialSourceRow = {
  agentId: string
  gameId: string
  attribute?: string
  status: string
  reason?: string
  coreCosts?: Record<string, MaterialRow>
  combatTables?: Record<string, Record<string, MaterialRow>>
  combatTableBySkill?: Record<string, string>
  source: { url: string; sourceVersion: string; sha256?: string }
}
const sources = new Map(
  (sourceData.rows as unknown as readonly MaterialSourceRow[]).map((row) => [row.agentId, row]),
)
// Resource attribute belongs to the chip ID, not to a special-attribute owner.
// Wind/Lumiflux chip IDs are independently present in their own source tables.
const chipAttributeBySuffix: Record<string, string> = {
  '0': 'physical',
  '1': 'fire',
  '2': 'ice',
  '3': 'electric',
  '5': 'ether',
  '6': 'wind',
  '7': 'lumiflux',
}

export const skillInvestmentMaterialsIdentity = Object.freeze({
  revision: 'fixed-3.2-exact-agent-paid-level-materials-r2',
  sourceVersion: sourceData.sourceVersion,
  contentHash: sourceData.contentHash,
  agentCount: sources.size,
  supportedAgentCount: [...sources.values()].filter((row) => row.status === 'supported').length,
  locator: 'passive.materials[currentBaseLevel];skill[skillKey].material[currentBaseLevel]',
  scope:
    'each current agent individually sourced; all five combat dictionaries verified; no attribute-based core or chip identity inference',
})

export function resolveSkillInvestmentMaterials(input: {
  agentId: string
  skill: SkillKey
  currentBaseLevel: number
}) {
  const unknown = (reason: string) => ({ status: 'unknown' as const, reason })
  const contract = getCurrentAgentEventContract(input.agentId)
  const actor = sources.get(input.agentId)
  if (
    !contract ||
    !actor ||
    actor.status !== 'supported' ||
    actor.gameId !== contract.externalId ||
    actor.attribute !== contract.identity.attribute ||
    actor.source.sourceVersion !== '3.2' ||
    !/^[A-F0-9]{64}$/u.test(actor.source.sha256 ?? '')
  )
    return unknown(actor?.reason ?? '该主体未建立身份匹配的已锁定材料表。')
  const maxBeforeUpgrade = input.skill === 'core' ? 6 : 11
  if (
    !Number.isInteger(input.currentBaseLevel) ||
    input.currentBaseLevel < 1 ||
    input.currentBaseLevel > maxBeforeUpgrade
  )
    return unknown('付费基础等级超出可升级材料行；不能以有效影画等级索引材料。')
  const table =
    input.skill === 'core'
      ? actor.coreCosts
      : actor.combatTables?.[actor.combatTableBySkill?.[input.skill] ?? '']
  const row = table?.[String(input.currentBaseLevel)]
  if (
    !row ||
    !Object.keys(row).length ||
    Object.values(row).some((value) => !Number.isSafeInteger(value) || value <= 0)
  )
    return unknown('该主体具名技能的材料行缺失或非法；不补零。')
  // Exact item IDs are retained. These categories only provide display semantics.
  const itemOrder = (id: string) =>
    id === '10'
      ? 0
      : input.skill === 'core' && /^1100[0-9]{2}$/u.test(id)
        ? 2
        : id === '100941'
          ? 2
          : 1
  const materials = Object.entries(row)
    .sort(([a], [b]) => itemOrder(a) - itemOrder(b) || Number(a) - Number(b))
    .map(([itemId, quantity]) => {
      if (itemId === '10') return { itemId, quantity, kind: 'denny' as const }
      if (itemId === '100941') return { itemId, quantity, kind: 'hamster_cage_pass' as const }
      if (input.skill !== 'core' && /^1001[123][0-9]$/u.test(itemId))
        return {
          itemId,
          quantity,
          kind: 'attribute_chip' as const,
          attribute: chipAttributeBySuffix[itemId.at(-1)!],
          grade: Number(itemId.at(-2)),
        }
      if (input.skill === 'core' && /^1105[0-9]{2}$/u.test(itemId))
        return { itemId, quantity, kind: 'expert_challenge' as const }
      if (input.skill === 'core' && /^1100[0-9]{2}$/u.test(itemId))
        return { itemId, quantity, kind: 'notorious_hunt' as const }
      return { itemId, quantity, kind: 'source_material' as const }
    })
  const locator =
    input.skill === 'core'
      ? `passive.materials.${input.currentBaseLevel}`
      : `skill.${input.skill}.material.${input.currentBaseLevel}`
  return {
    status: 'supported' as const,
    fromBaseLevel: input.currentBaseLevel,
    toBaseLevel: input.currentBaseLevel + 1,
    materials,
    sourceRefs: [`${actor.source.url}#${actor.source.sha256}:${locator}`],
    // Preserve the existing API vocabulary; each combat table is now verified for its exact owner.
    costBasis:
      input.skill === 'core'
        ? ('character_specific_core_table' as const)
        : ('shared_attribute_combat_table' as const),
  }
}
