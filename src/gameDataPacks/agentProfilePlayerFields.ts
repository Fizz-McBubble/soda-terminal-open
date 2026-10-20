import { strings } from './agentProfileBuildKnowledgeProjection'
import { canonicalFieldConflictLedger, type CanonicalFieldStatus } from './canonicalBaseline'
import { type PlayerBuildField, type PlayerBuildSource } from './playerBuildProfiles'
import {
  getReviewedGuideBuildConditions,
  getReviewedHistoricalWEngineReferences,
} from './reviewedGuideBuildDirections'
import { getArchivedGuideSetSupplements } from './archivedGuideSetSections'
import {
  type AgentProfileFieldStatus,
  type AgentProfileSourceRef,
  type AgentProfileField,
} from './agentProfileFieldProjection'
import { resolveBuildFieldApplicability } from './buildApplicabilityDependencyAnalysis'

// Frozen review identity; moving the projection does not upgrade its source version.
const legacyProfileReviewVersion = '3.1'
export function sourceRef(source: PlayerBuildSource | null): AgentProfileSourceRef[] {
  if (!source) return []
  return [
    {
      id: source.id,
      url: source.url,
      sourceVersion: source.sourceVersion,
      originalSourceVersion: source.originalSourceVersion ?? source.sourceVersion,
      checkedAt: source.checkedAt,
      contentHash: source.contentHash,
      licenseBoundary: source.licenseBoundary,
      authorReviewedVersion: source.authorReviewedVersion ?? null,
      pageUpdatedAt: source.pageUpdatedAt ?? null,
      retrievedAt: source.retrievedAt ?? source.checkedAt,
    },
  ]
}

export function canonicalStatus(status: CanonicalFieldStatus): AgentProfileFieldStatus {
  return status === 'formal' ? 'formal' : status
}

export function conflictsFor(agentId: string, path: string) {
  return (
    canonicalFieldConflictLedger.find((item) => item.fieldPath === `${agentId}.${path}`) ?? null
  )
}

function playerFieldGroup(path: string): AgentProfileField['group'] {
  if (path === 'identity') return 'identity_version'
  if (path.startsWith('progression.')) return 'progression'
  if (path.startsWith('build.')) return 'build_guidance'
  return 'equipment_facts'
}

export function projectedPlayerField(field: PlayerBuildField, agentId: string): AgentProfileField {
  const conflict = conflictsFor(agentId, field.path)
  const supplements = getReviewedGuideBuildConditions(agentId, field.path)
  const historicalWEngines =
    field.path === 'build.wengines' ? getReviewedHistoricalWEngineReferences(agentId) : []
  const applicabilityResult = resolveBuildFieldApplicability(
    agentId,
    field.path,
    field.source,
    '3.2',
  )
  const conditions = [
    ...(agentId === 'agent-banyue' && field.path === 'build.drive_disc_sets'
      ? [
          '炎狱重金属2件是原文限定副词条优秀时的备选；尚未完成同面板比较，只保留来源参考，自动匹配保留折枝剑歌或啄木鸟电音副套。',
        ]
      : []),
    ...(agentId === 'agent-evelyn' && field.path === 'build.drive_disc_sets'
      ? [
          '自动匹配仍沿用已收录的2+2+2散搭候选；其他已归档配装与操作条件在历史参考中展示。可用不代表当前毕业或唯一优选，同面板收益及当前优先级仍待核验。',
        ]
      : []),
    ...(agentId === 'agent-nangong' && field.path === 'build.drive_disc_sets'
      ? [
          '单人可用法厄同4件搭配精通2件；爱芮队沿用该方向，其他异常输出与支援组队时可选静听4件，通过快速支援叠加效果。',
        ]
      : []),
    ...(agentId === 'agent-grace' && field.path === 'build.drive_disc_sets'
      ? [
          '雷暴重金属4件需要感电覆盖；当前未核验该条件，只保留来源参考，自动匹配沿用自由蓝调4件方向。',
        ]
      : []),
    ...supplements.flatMap((supplement) => supplement.conditions),
    ...historicalWEngines.flatMap((reference) => reference.conditions),
    ...(applicabilityResult.currentApplicability === 'affected_pending'
      ? [applicabilityResult.reason]
      : []),
  ]
  const archivedSets =
    field.path === 'build.drive_disc_sets' ? getArchivedGuideSetSupplements(agentId) : null
  const currentApplicability = applicabilityResult.currentApplicability
  const lastChangeVersion =
    applicabilityResult.currentApplicability === 'affected_pending' ? '3.2' : null

  return {
    group: playerFieldGroup(field.path),
    path: field.path,
    value: archivedSets
      ? [
          ...strings(field.value),
          ...archivedSets.sets.map(
            (text) => `历史来源参考（当前适用性待核验，不参与自动配装）：${text}`,
          ),
        ]
      : field.value,
    status:
      field.status === 'candidate' && field.source?.verified && !conflict
        ? 'verified_candidate'
        : field.status,
    gameVersion: legacyProfileReviewVersion,
    originalSourceVersion:
      field.originalSourceVersion ??
      field.source?.originalSourceVersion ??
      field.source?.sourceVersion ??
      null,
    lastChangeVersion,
    currentApplicability,
    authorReviewedVersion:
      applicabilityResult.authorReviewedVersion ??
      field.authorReviewedVersion ??
      field.source?.authorReviewedVersion ??
      null,
    applicabilityReason: applicabilityResult.reason,
    sourceRefs: [
      ...sourceRef(field.source).map((ref) =>
        field.sourceValues ? { ...ref, supportedValues: field.sourceValues } : ref,
      ),
      ...(field.supplementalSources ?? []).flatMap((supplement) =>
        sourceRef(supplement.source).map((ref) => ({
          ...ref,
          supportedValues: supplement.values,
          ...(supplement.conditionsByValue
            ? { conditionsByValue: supplement.conditionsByValue }
            : {}),
        })),
      ),
      ...supplements
        .filter(
          (supplement) =>
            !field.supplementalSources?.some((entry) => entry.source.id === supplement.source.id),
        )
        .flatMap((supplement) => sourceRef(supplement.source)),
      ...sourceRef(archivedSets?.source ?? null),
      ...(archivedSets?.additionalSources ?? []).flatMap((source) => sourceRef(source)),
      ...historicalWEngines.flatMap((reference) => sourceRef(reference.source)),
    ],
    ...(conditions.length ? { conditions } : {}),
    verifiedAt: field.source?.checkedAt ?? null,
    conflict,
    reason: conflict ? `${field.reason}；存在来源差异，保留候选而不静默采用。` : field.reason,
  }
}
