import { z } from 'zod'
import type { AccountRoster } from '../assault/types'

export const rosterSnapshotSchema = z.object({
  format: z.literal('soda-terminal-roster'),
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exportedAt: z.string().datetime(),
  source: z.enum(['manual', 'local', 'showcase', 'external_export']),
  completeness: z.enum(['complete', 'partial', 'showcase']),
  agents: z.array(
    z.object({
      agentId: z.string().min(1),
      owned: z.boolean(),
      priority: z.number().int().min(1).max(5),
      level: z.number().int().min(1).max(60),
      ascension: z.number().int().min(0).max(5).nullable().optional(),
      mindscape: z.number().int().min(0).max(6),
      skills: z.string(),
      wEngine: z.string(),
      refinement: z.number().int().min(0).max(5),
      agentVersion: z.string().min(1),
      completeness: z.enum(['complete', 'partial', 'missing']),
      currentEquipment: z.enum(['known', 'unknown']),
      manualSource: z.enum(['manual_initial_default', 'manual_override']).nullable().optional(),
      potentialImage: z.number().int().min(0).max(6).nullable().optional(),
      progressionManuallySet: z.boolean().optional(),
      lockedFields: z.array(z.string().min(1)).optional(),
      syncedAt: z.string().datetime(),
      skillLevels: z
        .object({
          // Snapshots store effective levels including M3/M5 bonuses, not base levels.
          // Keep valid account facts intact; progression warnings belong to the editor.
          basic: z.number().int().min(1).max(16).nullable(),
          dodge: z.number().int().min(1).max(16).nullable(),
          assist: z.number().int().min(1).max(16).nullable(),
          special: z.number().int().min(1).max(16).nullable(),
          chain: z.number().int().min(1).max(16).nullable(),
          core: z.preprocess((value) => {
            if (typeof value === 'number') return value
            if (typeof value !== 'string') return value
            if (/^[1-7]$/.test(value)) return Number(value)
            const level = value.toUpperCase().charCodeAt(0) - 64
            return level >= 1 && level <= 7 ? level : value
          }, z.number().int().min(1).max(7).nullable()),
        })
        .optional(),
      wEngineDetails: z
        .object({
          id: z.string().min(1).nullable().optional(),
          name: z.string().min(1).nullable(),
          level: z.number().int().min(1).max(60).nullable(),
          ascension: z.number().int().min(0).max(5).nullable().optional(),
          refinement: z.number().int().min(0).max(5).nullable(),
        })
        .optional(),
      wEngineCopyId: z.string().min(1).nullable().optional(),
      equippedDiscIds: z.array(z.string().min(1)).max(6).nullable().optional(),
      damageInput: z
        .object({
          attack: z.number().positive(),
          multiplier: z.number().positive(),
          damageBonus: z.number().nonnegative(),
          critRate: z.number().min(0).max(1),
          critDamage: z.number().nonnegative(),
          anomalyDamage: z.number().nonnegative(),
          cycleSeconds: z.number().positive(),
          source: z.string().min(1),
          updatedAt: z.string().datetime(),
        })
        .optional(),
    }),
  ),
  bangboos: z.array(
    z.object({
      bangbooId: z.string().min(1),
      owned: z.boolean(),
      level: z.number().int().min(1).max(60).nullable(),
      stars: z.number().int().min(0).max(6).nullable().optional(),
      skillLevel: z.number().int().min(1).max(10).nullable().optional(),
      additionalAbilityLevel: z.number().int().min(1).max(5).nullable().optional(),
      manualSource: z.enum(['manual_initial_default', 'manual_override']).nullable().optional(),
      starsManuallySet: z.boolean().optional(),
    }),
  ),
  wEngines: z
    .array(
      z.object({
        copyId: z.string().min(1).optional(),
        engineId: z.string().min(1),
        level: z.number().int().min(1).max(60),
        refinement: z.number().int().min(0).max(5),
        equippedAgentId: z.string().min(1).nullable().optional(),
        manualSource: z.enum(['manual_initial_default', 'manual_override']),
        refinementManuallySet: z.boolean().optional(),
      }),
    )
    .optional(),
})

export type RosterSnapshot = z.infer<typeof rosterSnapshotSchema>

function toSnapshotAgent(agent: AccountRoster['agents'][number]): RosterSnapshot['agents'][number] {
  return {
    agentId: agent.agentId,
    owned: agent.owned,
    priority: agent.priority,
    level: agent.level,
    ...('ascension' in agent ? { ascension: agent.ascension } : {}),
    mindscape: agent.mindscape,
    skills: agent.skills,
    wEngine: agent.wEngine,
    refinement: agent.refinement,
    agentVersion: agent.agentVersion,
    completeness: agent.completeness,
    currentEquipment: agent.currentEquipment,
    manualSource: agent.manualSource,
    potentialImage: agent.potentialImage,
    progressionManuallySet: agent.progressionManuallySet,
    lockedFields: agent.lockedFields,
    syncedAt: agent.syncedAt,
    skillLevels: agent.skillLevels,
    wEngineDetails: agent.wEngineDetails,
    wEngineCopyId: agent.wEngineCopyId,
    equippedDiscIds: agent.equippedDiscIds,
    damageInput: agent.damageInput,
  }
}

export function createRosterSnapshotAdapter({
  agentIds,
  bangbooIds,
  normalizeWEngineInstances,
}: {
  agentIds: ReadonlySet<string>
  bangbooIds: ReadonlySet<string>
  normalizeWEngineInstances: (roster: AccountRoster) => AccountRoster
}) {
  function exportRosterSnapshot(roster: AccountRoster): RosterSnapshot {
    return {
      format: 'soda-terminal-roster',
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      source: 'local',
      completeness: roster.sourceCompleteness,
      agents: roster.agents.map(toSnapshotAgent),
      bangboos: roster.bangboos.map((bangboo) => ({ ...bangboo })),
      wEngines: roster.wEngines?.map((copy) => ({ ...copy })),
    }
  }

  function preflightRosterSnapshot(input: unknown, current: AccountRoster) {
    const snapshot = rosterSnapshotSchema.parse(input)
    return {
      snapshot,
      partial: snapshot.completeness !== 'complete',
      unknownAgents: snapshot.agents
        .filter((agent) => !agentIds.has(agent.agentId))
        .map((agent) => agent.agentId),
      unknownBangboos: snapshot.bangboos
        .filter((item) => !bangbooIds.has(item.bangbooId))
        .map((item) => item.bangbooId),
      changes: snapshot.agents.filter((incoming) => {
        const existing = current.agents.find((agent) => agent.agentId === incoming.agentId)
        return existing && JSON.stringify(toSnapshotAgent(existing)) !== JSON.stringify(incoming)
      }).length,
    }
  }

  function applyRosterSnapshot(snapshot: RosterSnapshot, current: AccountRoster): AccountRoster {
    const partial = snapshot.completeness !== 'complete'
    const incoming = new Map(snapshot.agents.map((agent) => [agent.agentId, agent]))
    return normalizeWEngineInstances({
      ...current,
      sourceCompleteness: snapshot.completeness,
      agents: current.agents.map((existing) => {
        const next = incoming.get(existing.agentId)
        if (!next)
          return partial ? existing : { ...existing, owned: false, source: 'roster_snapshot' }
        const allowed = Object.entries(next).filter(
          ([field]) =>
            !existing.lockedFields.includes(field) &&
            field !== 'wEngineDetails' &&
            field !== 'wEngineCopyId' &&
            field !== 'wEngine' &&
            field !== 'refinement',
        )
        return {
          ...existing,
          ...Object.fromEntries(allowed),
          manualSource: next.manualSource ?? existing.manualSource,
          source: snapshot.source === 'showcase' ? 'showcase' : 'roster_snapshot',
          lockedFields: existing.lockedFields,
        }
      }),
      bangboos: current.bangboos.map((existing) => {
        const next = snapshot.bangboos.find((item) => item.bangbooId === existing.bangbooId)
        if (!next) return partial ? existing : { ...existing, owned: false }
        return {
          ...existing,
          ...next,
          stars: next.stars ?? existing.stars,
          skillLevel: snapshot.schemaVersion >= 3 ? (next.skillLevel ?? null) : null,
          additionalAbilityLevel:
            snapshot.schemaVersion >= 3 ? (next.additionalAbilityLevel ?? null) : null,
          manualSource: next.manualSource ?? existing.manualSource,
        }
      }),
      // Snapshot/import is not a Current W-Engine write path. Keep legacy rows unchanged.
      wEngines: current.wEngines,
      updatedAt: new Date().toISOString(),
    })
  }

  return { exportRosterSnapshot, preflightRosterSnapshot, applyRosterSnapshot }
}
