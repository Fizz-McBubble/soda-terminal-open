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
  const groups = new Map<string, number>()
  for (const issue of candidate.issues) {
    const label = ['duplicate_uid', 'unknown_disc_catalog', 'unsupported_disc_catalog'].includes(
      issue.code,
    )
      ? '驱动盘身份需核对'
      : issue.kind === 'discs'
        ? '驱动盘词条需核对'
        : '读取结果完整性需核对'
    groups.set(label, (groups.get(label) ?? 0) + 1)
  }
  return {
    snapshotId: candidate.snapshotSha256,
    counts: { agents: candidate.counts.importableAgents, discs: candidate.counts.discs },
    compactSummary: [
      `其中 S 级 ${candidate.counts.sDiscs} 张，A/B 级 ${candidate.counts.discs - candidate.counts.sDiscs} 张；配装与分析只使用 S 级。`,
      ...(plan
        ? [
            `驱动盘新增 ${plan.summary.newDiscs} 张、更新 ${plan.summary.updatedDiscs} 张、保留 ${plan.summary.retainedDiscs} 张。`,
            [
              plan.summary.syncedManualProgressionFields
                ? `更新已录入养成资料 ${plan.summary.syncedManualProgressionFields} 项`
                : '',
              plan.summary.protectedFields
                ? `保留现有养成记录 ${plan.summary.protectedFields} 项`
                : '',
              plan.summary.inferredDiscLinks
                ? `按相同属性匹配旧扫描盘 ${plan.summary.inferredDiscLinks} 张，请核对盘数`
                : '',
            ]
              .filter(Boolean)
              .join('；'),
          ]
        : []),
    ].filter(Boolean),
    validSummary: [
      `其中 S 级 ${candidate.counts.sDiscs} 张，A/B 级 ${candidate.counts.discs - candidate.counts.sDiscs} 张；A/B 级记录保留，不参与配装与分析。`,
      ...(plan
        ? [
            `将新增 ${plan.summary.newDiscs} 张、更新 ${plan.summary.updatedDiscs} 张驱动盘${plan.summary.retainedDiscs ? `；保留 ${plan.summary.retainedDiscs} 张原有驱动盘` : ''}。`,
            ...(plan.summary.protectedFields
              ? [`保留 ${plan.summary.protectedFields} 项现有养成记录。`]
              : []),
            ...(plan.summary.syncedManualProgressionFields
              ? [`将更新 ${plan.summary.syncedManualProgressionFields} 项已录入养成资料。`]
              : []),
            ...(plan.summary.inferredDiscLinks
              ? [`本次按相同属性匹配 ${plan.summary.inferredDiscLinks} 张旧扫描盘，请核对数量。`]
              : []),
          ]
        : []),
    ],
    issues: [
      ...candidate.issues.map((issue) => issue.message),
      ...(review.issue ? [review.issue] : []),
    ],
    issueSummary: [
      ...(candidate.issues.length > 3
        ? [...groups].map(([label, count]) => `${label}：${count} 项`)
        : candidate.issues.map((issue) => issue.message)),
      ...(review.issue ? [review.issue] : []),
    ],
    agents: candidate.agents.map((agent) => {
      const skills = agent.fields.skillLevels
      return {
        agentId: agent.agentId,
        name: agent.name,
        level: agent.fields.level,
        mindscape: agent.fields.mindscape,
        ...(skills
          ? {
              skills: `普攻 ${skills.basic ?? '未读取'} · 闪避 ${skills.dodge ?? '未读取'} · 支援 ${skills.assist ?? '未读取'} · 特殊 ${skills.special ?? '未读取'} · 连携 ${skills.chain ?? '未读取'} · 核心 ${skills.core == null ? '未读取' : skills.core === 1 ? '未解锁' : String.fromCharCode(64 + skills.core - 1)}`,
            }
          : {}),
        ...(agent.fields.wEngineDetails?.name ? { wEngine: agent.fields.wEngineDetails.name } : {}),
      }
    }),
  }
}
