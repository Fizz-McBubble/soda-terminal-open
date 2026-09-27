import { current31IndependentConsensusGoldSet } from './current31IndependentConsensusGoldSet'
import { evaluateCurrent31ObservedTeamSet } from './current31TeamStrengthObservedEvaluation'

const knownSetEvaluation = evaluateCurrent31ObservedTeamSet({
  datasetId: current31IndependentConsensusGoldSet.contract,
  observations: current31IndependentConsensusGoldSet.observations,
  boundary:
    '这是与 production identity 同构的已知集合一致性诊断。它不构成独立 Top-K holdout；每个 case 禁止从无序推荐列表制造 pairwise；预测结果不回写校准标签。',
})

export const current31IndependentConsensusGoldSetEvaluation = Object.freeze({
  ...knownSetEvaluation,
  evaluationKind: 'known_set_consistency' as const,
  constructionDependency: Object.freeze({
    status: 'same_identity_construction_dependent' as const,
    productionMembershipSource: current31IndependentConsensusGoldSet.contract,
    evaluationMembershipSource: current31IndependentConsensusGoldSet.contract,
    sharedIdentityCount: knownSetEvaluation.predictionCount,
    independentTopKEligible: false,
    explanation:
      'production recognition 与这 30 个观察共同从同一 Independent Consensus Gold Set 构造；30/30 只能证明已知集合一致性，不能证明独立 Top-K 召回。',
  }),
  knownSetConsistency: Object.freeze({
    status:
      knownSetEvaluation.predictionCount > 0 &&
      knownSetEvaluation.recognizedCount === knownSetEvaluation.predictionCount
        ? ('pass' as const)
        : ('fail' as const),
    caseCount: knownSetEvaluation.predictionCount,
    recognizedCount: knownSetEvaluation.recognizedCount,
    recognitionRatio: knownSetEvaluation.recognitionRatio,
    experimentalCount: knownSetEvaluation.experimentalCount,
  }),
  independentTopK: Object.freeze({
    status: 'not_evaluated' as const,
    observed: null,
    target: null,
    explanation:
      '没有与 production membership identity 解耦的 exact 3-agent 主流 Top-K 标签，故严格透传为 not_evaluated。',
  }),
})
