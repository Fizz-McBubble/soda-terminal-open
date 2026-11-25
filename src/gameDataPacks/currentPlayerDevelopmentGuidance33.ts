import {
  getCurrentBuildAuthorityProfile as readAuthority,
  getCurrentBuildTargetPanel as readPanel,
} from './currentBuildAuthority'
import { getAgentProfile, getProjectedBuildKnowledgeProfile as readProfile } from './agentProfile'
import { projectBuildKnowledgeProfile } from './agentProfileBuildKnowledgeProjection'
import { stableContentHash } from './types'
import reviewed from './data/reviewed-severian-build-guidance.3.3.json'

import {
  correctSeverianConditions,
  severianSignatureCritCondition,
} from './severianPlayerConditions33'

function reviewedPanel<
  T extends {
    value: unknown
    sourceRefs: readonly { id: string }[]
    conditions: readonly string[]
  },
>(panel: T, context?: Parameters<typeof readPanel>[1]) {
  const conditions = correctSeverianConditions(panel.conditions)
  const signature = severianSignatureCritCondition(context?.engineId, context?.engineRefinement)
  if (signature) conditions.push(signature)
  return { ...panel, conditions }
}

export function getPlayerBuildTargetPanel(...args: Parameters<typeof readPanel>) {
  const panel = readPanel(...args)
  if (args[0] !== reviewed.agentId || !panel?.sourceRefs.some((s) => s.id === reviewed.id))
    return panel
  return reviewedPanel(panel, args[1])
}

export function getPlayerBuildAuthorityProfile(...args: Parameters<typeof readAuthority>) {
  const profile = readAuthority(...args)
  if (args[0] !== reviewed.agentId || !profile) return profile
  const fields = profile.guidance.fields.map((field) => {
    if (!field.sourceRefs.some((source) => source.id === reviewed.id)) return field
    if (field.fieldId === 'build.target_panel') return reviewedPanel(field, args[1])
    if (field.fieldId === 'progression.skill_core_cinema') {
      const value = field.value as { formedReference?: { conditions?: readonly string[] } } | null
      const formed = value?.formedReference
      if (formed?.conditions)
        return {
          ...field,
          conditions: correctSeverianConditions(field.conditions),
          value: {
            ...value,
            formedReference: {
              ...formed,
              conditions: correctSeverianConditions(formed.conditions),
            },
          },
        }
    }
    return { ...field, conditions: correctSeverianConditions(field.conditions) }
  })
  const next = { ...profile, guidance: { ...profile.guidance, fields } }
  return { ...next, contentHash: stableContentHash({ ...next, contentHash: undefined }) }
}

export function getPlayerBuildKnowledgeProfile(agentId: string) {
  if (agentId !== reviewed.agentId) return readProfile(agentId)
  const profile = getAgentProfile(agentId)
  const fields = profile.fields.map((field) => {
    if (field.path !== 'build.team_bangboo_scenario' || !Array.isArray(field.value)) return field
    return {
      ...field,
      value: field.value.map((value) =>
        typeof value === 'string' ? correctSeverianConditions([value])[0] : value,
      ),
    }
  })
  return projectBuildKnowledgeProfile(agentId, { ...profile, fields })
}
