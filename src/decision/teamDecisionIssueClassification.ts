import { stableContentHash } from '../gameDataPacks/types'
import {
  teamDecisionAuthorityContractId,
  teamRatingBlockerIssueIds,
  type DecisionProvenanceKind,
  type UnsupportedDecisionClass,
  type UnsupportedDecisionIssue,
} from './teamDecisionAuthority'

export const teamDecisionIssueClassificationContractId =
  'soda-team-decision-issue-classification/v1' as const

type BangbooDecisionConditionDefinition = {
  conditionKey: string
  inputKind: 'flag' | 'accumulator'
  classification: UnsupportedDecisionClass
  provenance: DecisionProvenanceKind
  impact: string
}

export const currentBangbooDecisionConditionDefinitions = Object.freeze<
  readonly BangbooDecisionConditionDefinition[]
>([
  {
    conditionKey: 'agent_ex_special_used',
    inputKind: 'flag',
    classification: 'rotation_sensitive',
    provenance: 'baseline_assumption',
    impact: '是否使用强化特殊技取决于具名事件序列；影响 Benchmark，不决定队伍是否合法。',
  },
  {
    conditionKey: 'agent_ultimate_used',
    inputKind: 'flag',
    classification: 'rotation_sensitive',
    provenance: 'baseline_assumption',
    impact: '是否使用终结技取决于具名事件序列；影响 Benchmark，不决定队伍是否合法。',
  },
  {
    conditionKey: 'enemy_daze_above_50',
    inputKind: 'flag',
    classification: 'environment_specific',
    provenance: 'baseline_assumption',
    impact: '敌人失衡阈值属于 Scenario Context；未选择场景时不阻断 Team Rating。',
  },
  {
    conditionKey: 'enemy_organic',
    inputKind: 'flag',
    classification: 'environment_specific',
    provenance: 'baseline_assumption',
    impact: '敌人类型属于 Scenario Context；未选择场景时不阻断 Team Rating。',
  },
  {
    conditionKey: 'ex_special_stacks_at_maximum',
    inputKind: 'flag',
    classification: 'rotation_sensitive',
    provenance: 'derived_state',
    impact: '满层状态由事件与资源变化派生；影响 Benchmark，不决定队伍是否合法。',
  },
  {
    conditionKey: 'marked_enemy_defeated',
    inputKind: 'flag',
    classification: 'environment_specific',
    provenance: 'derived_state',
    impact: '击杀标记依赖敌人与事件结果；进入 Scenario Context，不阻断 Team Rating。',
  },
  {
    conditionKey: 'on_field_anomaly',
    inputKind: 'flag',
    classification: 'benchmark_relevant',
    provenance: 'derived_state',
    impact: '场上异常角色由 field-time 状态派生；缺失时降低 Benchmark Confidence。',
  },
  {
    conditionKey: 'on_field_attack',
    inputKind: 'flag',
    classification: 'benchmark_relevant',
    provenance: 'derived_state',
    impact: '场上强攻角色由 field-time 状态派生；缺失时降低 Benchmark Confidence。',
  },
  {
    conditionKey: 'on_field_stun',
    inputKind: 'flag',
    classification: 'benchmark_relevant',
    provenance: 'derived_state',
    impact: '场上击破角色由 field-time 状态派生；缺失时降低 Benchmark Confidence。',
  },
  {
    conditionKey: 'active_skill_activations',
    inputKind: 'accumulator',
    classification: 'rotation_sensitive',
    provenance: 'baseline_assumption',
    impact: '主动技次数必须由具名事件合同声明；缺失时降低 Benchmark Confidence。',
  },
])

const definitionByConditionKey = new Map(
  currentBangbooDecisionConditionDefinitions.map((definition) => [
    definition.conditionKey,
    definition,
  ]),
)

if (definitionByConditionKey.size !== currentBangbooDecisionConditionDefinitions.length)
  throw new Error('Bangboo decision condition definition 存在重复 key。')

export const decisionProvenancePolicies = Object.freeze([
  { subject: 'game_numeric_operand', provenance: 'source_fact' as const },
  { subject: 'account_recorded_fact', provenance: 'source_fact' as const },
  { subject: 'comparison_window', provenance: 'baseline_assumption' as const },
  { subject: 'fixed_event_count', provenance: 'baseline_assumption' as const },
  { subject: 'on_field_specialty', provenance: 'derived_state' as const },
  { subject: 'field_time_allocation', provenance: 'derived_state' as const },
])

export type DecisionProvenanceSubject = (typeof decisionProvenancePolicies)[number]['subject']

const provenanceBySubject = new Map(
  decisionProvenancePolicies.map((policy) => [policy.subject, policy.provenance]),
)

export function resolveDecisionProvenance(subject: string) {
  const provenance = provenanceBySubject.get(subject as DecisionProvenanceSubject)
  return provenance
    ? { status: 'supported' as const, subject, provenance }
    : {
        status: 'unsupported' as const,
        blockers: [`未知 Decision provenance subject：${subject}`],
      }
}

const flagPrefix = '缺少邦布事件 flag：'
const accumulatorPrefix = '缺少邦布累计量：'

function parseBangbooConditionBlocker(blocker: string) {
  if (blocker.startsWith(flagPrefix))
    return { inputKind: 'flag' as const, conditionKey: blocker.slice(flagPrefix.length) }
  if (blocker.startsWith(accumulatorPrefix))
    return {
      inputKind: 'accumulator' as const,
      conditionKey: blocker.slice(accumulatorPrefix.length),
    }
  return null
}

export function classifyCurrentBangbooDecisionBlocker(blocker: string) {
  const parsed = parseBangbooConditionBlocker(blocker)
  if (!parsed)
    return {
      status: 'unsupported' as const,
      blockers: [`不是已登记的邦布 condition blocker：${blocker}`],
    }
  const definition = definitionByConditionKey.get(parsed.conditionKey)
  if (!definition)
    return {
      status: 'unsupported' as const,
      blockers: [`未知邦布 Decision condition：${parsed.conditionKey}`],
    }
  if (definition.inputKind !== parsed.inputKind)
    return {
      status: 'unsupported' as const,
      blockers: [
        `邦布 Decision condition kind 不一致：${parsed.conditionKey} 应为 ${definition.inputKind}。`,
      ],
    }
  const issue: UnsupportedDecisionIssue = {
    issueId: `bangboo-condition:${definition.conditionKey}`,
    conditionKey: definition.conditionKey,
    classification: definition.classification,
    impact: definition.impact,
    evidenceRefs: [],
  }
  return {
    status: 'supported' as const,
    inputKind: definition.inputKind,
    provenance: definition.provenance,
    issue,
  }
}

export function classifyCurrentBangbooDecisionBlockerCounts(
  blockerCounts: Readonly<Record<string, number>>,
) {
  const classified = Object.entries(blockerCounts).flatMap(([blocker, occurrences]) => {
    const result = classifyCurrentBangbooDecisionBlocker(blocker)
    return result.status === 'supported' ? [{ blocker, occurrences, ...result }] : []
  })
  const unclassified = Object.entries(blockerCounts).flatMap(([blocker, occurrences]) => {
    const result = classifyCurrentBangbooDecisionBlocker(blocker)
    return result.status === 'unsupported'
      ? [{ blocker, occurrences, blockers: result.blockers }]
      : []
  })
  const issueOccurrences = Object.fromEntries(
    classified.map((entry) => [entry.issue.issueId, entry.occurrences]),
  )
  const issues = classified.map((entry) => entry.issue)
  const classificationOccurrences = Object.fromEntries(
    ['mechanic_critical', 'benchmark_relevant', 'rotation_sensitive', 'environment_specific'].map(
      (classification) => [
        classification,
        classified
          .filter((entry) => entry.issue.classification === classification)
          .reduce((sum, entry) => sum + entry.occurrences, 0),
      ],
    ),
  ) as Record<UnsupportedDecisionClass, number>
  const ratingBlockerIssueIds = teamRatingBlockerIssueIds(issues)
  const projection = {
    contract: teamDecisionIssueClassificationContractId,
    authorityContract: teamDecisionAuthorityContractId,
    conditionDefinitionCount: currentBangbooDecisionConditionDefinitions.length,
    classifiedConditionCount: classified.length,
    unclassified,
    issues,
    issueOccurrences,
    classificationOccurrences,
    ratingBlockerIssueIds,
    teamRatingBlocked: unclassified.length > 0 || ratingBlockerIssueIds.length > 0,
  }
  return { ...projection, fingerprint: stableContentHash(projection) }
}
