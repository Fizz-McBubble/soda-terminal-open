import { buildProfileSchema, type BuildProfile } from './schemas'
import { evaluationRules, loadProfiles } from '../evaluation/rules'
import { gameData } from '../data/gameData'

const roleByTemplateId: Record<string, BuildProfile['role']> = {
  'profile-billy-direct-damage': 'damage',
  'profile-anby-stun': 'stun',
  'profile-nicole-support': 'support',
  'profile-velina-vortex-support': 'anomaly',
}

export function getBuiltInTemplates(
  now = gameData?.updatedAt ?? '2026-06-14T00:00:00.000Z',
): BuildProfile[] {
  return loadProfiles().map((profile) =>
    buildProfileSchema.parse({
      ...profile,
      role: roleByTemplateId[profile.id] ?? 'damage',
      isDefault: true,
      sourceTemplateId: null,
      archived: false,
      createdAt: profile.createdAt ?? now,
      updatedAt: now,
    }),
  )
}

export function getNextTemplateVersion(version: string) {
  const match = version.match(/^(.*?)(?:-user\.(\d+))?$/)
  const base = match?.[1] || version
  const revision = Number(match?.[2] ?? 0) + 1
  return `${base}-user.${revision}`
}

export function validateTemplateReferences(template: BuildProfile) {
  const knownStats = new Set(Object.keys(evaluationRules.stats))
  const knownSets = new Set(gameData?.driveDiscSets.map((set) => set.id) ?? [])
  const unknownStat = Object.values(template.mainStatFit)
    .flatMap((weights) => Object.keys(weights))
    .find((stat) => !knownStats.has(stat))
  if (unknownStat) throw new Error(`模板包含未知词条：${unknownStat}`)
  const illegalSubStat = Object.keys(template.statWeights).find((stat) => !knownStats.has(stat))
  if (illegalSubStat) throw new Error(`模板包含未知副词条：${illegalSubStat}`)
  const illegalSlot = Object.keys(template.mainStatFit).find(
    (slot) => !['4', '5', '6'].includes(slot),
  )
  if (illegalSlot) throw new Error(`模板包含非法号位：${illegalSlot}`)
  for (const [slot, weights] of Object.entries(template.mainStatFit)) {
    const illegalMainStat = Object.keys(weights).find(
      (stat) => !evaluationRules.slots[slot]?.includes(stat as keyof typeof evaluationRules.stats),
    )
    if (illegalMainStat) throw new Error(`${slot} 号位包含非法主词条：${illegalMainStat}`)
  }
  const unknownSet = Object.keys(template.setFit).find((setId) => !knownSets.has(setId))
  if (unknownSet) throw new Error(`模板包含未知套装：${unknownSet}`)
  return template
}

export function copyTemplate(template: BuildProfile, name: string): BuildProfile {
  const now = new Date().toISOString()
  return validateTemplateReferences(
    buildProfileSchema.parse({
      ...structuredClone(template),
      id: crypto.randomUUID(),
      name,
      version: getNextTemplateVersion(template.version),
      isDefault: false,
      sourceTemplateId: template.sourceTemplateId ?? template.id,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }),
  )
}
