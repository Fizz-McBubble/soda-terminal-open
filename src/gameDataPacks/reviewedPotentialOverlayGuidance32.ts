import type { AgentProfileField } from './agentProfileFieldProjection'
import potentialGuidance from './data/reviewed-potential-overlay-guidance.3.2.json'

type PotentialGuidanceEntry = (typeof potentialGuidance.entries)[number]

const byAgentId = new Map<string, PotentialGuidanceEntry>(
  potentialGuidance.entries.map((entry) => [entry.agentId, entry]),
)

export function getReviewedPotentialOverlayGuidance32(
  agentId: string,
): AgentProfileField | undefined {
  const entry = byAgentId.get(agentId)
  if (!entry) return undefined
  const directCurrent = entry.sourceVersion === potentialGuidance.targetGameVersion
  return {
    group: 'build_guidance',
    path: 'progression.potential_overlay',
    value: {
      kind: 'historical_potential_skill_reference',
      requiredPotentialImage: 6,
      skillDirections: [...entry.sixSkillDirections],
      sixSkillTargets: { ...entry.sixSkillTargets },
      automaticApplication: false,
      sourceVersion: entry.sourceVersion,
      sourceState: directCurrent ? 'direct_current_3_2' : 'historical_continuity_reviewed',
      visualEvidence: { ...entry.visualEvidence },
    },
    status: 'verified_candidate',
    gameVersion: potentialGuidance.targetGameVersion,
    originalSourceVersion: entry.sourceVersion,
    lastChangeVersion: potentialGuidance.targetGameVersion,
    currentApplicability: 'continuous',
    sourceRefs: entry.sourceRefs.map((source) => ({
      id: source.id,
      url: source.url,
      sourceVersion: source.sourceVersion,
      checkedAt: source.checkedAt,
      contentHash: source.guideImageSha256,
      licenseBoundary: source.licenseBoundary,
    })),
    verifiedAt: entry.sourceRefs[0]?.checkedAt ?? null,
    conflict: null,
    reviewedSourceTier: directCurrent ? 'direct_current_3_2' : 'continuity_reviewed',
    reason: directCurrent
      ? '当前3.2作者图鉴明确显示潜能ON、STR 6/6与六项技能目标；仅作字段级养成参考。'
      : '作者图鉴明确显示潜能ON、STR 6/6与六项技能目标，并以字段级3.2连续性复审保留；不宣称作者重审3.2。',
    conditions: [
      ...entry.conditions,
      '潜能建议自动应用关闭；不创建账号已拥有、已激活潜能或计划DPS事实。',
      '六项目标来自同一作者HoYo青枫，未形成独立作者交叉共识。',
      ...(directCurrent
        ? []
        : ['来源版本早于3.2；只对六项技能投资建议做字段级连续性采用，不把旧机制文本扩写成当前效果。']),
    ],
  }
}

export const reviewedPotentialOverlayGuidance32 = Object.freeze({
  gameVersion: potentialGuidance.targetGameVersion,
  entries: potentialGuidance.entries,
})
