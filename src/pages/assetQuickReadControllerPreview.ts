import type { AssetQuickReadPreview } from './AssetQuickReadEntry'
import type { AssetQuickReadCandidate } from '../assetQuickRead/snapshotAdapter'
import type { AssetQuickReadImportPlan } from '../assetQuickRead/accountImport'

export type Reviewed = {
  raw: unknown
  candidate: AssetQuickReadCandidate
  plan: AssetQuickReadImportPlan | null
  issue?: string
}

export function previewOf(review: Reviewed): AssetQuickReadPreview {
  const { candidate, plan } = review
  return {
    snapshotId: candidate.snapshotSha256,
    counts: { agents: candidate.counts.importableAgents, discs: candidate.counts.sDiscs },
    validSummary: [
      ...(plan
        ? [
            `将新增 ${plan.summary.newDiscs} 张、更新 ${plan.summary.updatedDiscs} 张驱动盘${plan.summary.retainedDiscs ? `；保留 ${plan.summary.retainedDiscs} 张原有驱动盘` : ''}。`,
            ...(plan.summary.protectedFields
              ? [`保留 ${plan.summary.protectedFields} 个未读取、锁定或较新的字段。`]
              : []),
            ...(plan.summary.syncedManualProgressionFields
              ? [`将用本次读取值更新 ${plan.summary.syncedManualProgressionFields} 项手动养成。`]
              : []),
            ...(plan.summary.inferredDiscLinks
              ? [
                  `${plan.summary.inferredDiscLinks} 张旧扫描盘按完全相同属性对应物理实例，请同时核对盘数。`,
                ]
              : []),
          ]
        : []),
      ...(candidate.warnings ?? []),
    ],
    issues: [
      ...candidate.issues.map((issue) => issue.message),
      ...(review.issue ? [review.issue] : []),
    ],
    agents: candidate.agents.map((agent) => {
      const skills = agent.fields.skillLevels
      return {
        agentId: agent.agentId,
        name: agent.name,
        level: agent.fields.level!,
        mindscape: agent.fields.mindscape!,
        ...(skills
          ? {
              skills: `普攻 ${skills.basic} · 闪避 ${skills.dodge} · 支援 ${skills.assist} · 特殊 ${skills.special} · 连携 ${skills.chain} · 核心 ${String.fromCharCode(64 + (skills.core ?? 1) - 1) === '@' ? '未解锁' : String.fromCharCode(64 + (skills.core ?? 1) - 1)}`,
            }
          : {}),
        ...(agent.fields.wEngineDetails?.name ? { wEngine: agent.fields.wEngineDetails.name } : {}),
      }
    }),
  }
}
