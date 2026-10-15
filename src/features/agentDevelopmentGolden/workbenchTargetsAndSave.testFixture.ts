import { workbench } from './AgentDevelopmentGolden.workbench.testFixture'
import type { GoldenTop10Data, GoldenWorkbenchData } from './types'

export function createPanelDetailSubject(): GoldenWorkbenchData {
  return {
    ...workbench,
    panelFacts: [
      { key: 'pen', name: '穿透值', value: '0', currentValue: 0 },
      {
        key: 'iceDamageBonus',
        name: '冰属性伤害加成',
        value: '0%',
        currentValue: 0,
        detail: true,
        group: 'supplementary',
      },
      {
        key: 'fireDamageBonus',
        name: '火属性伤害加成',
        value: '0%',
        currentValue: 0.001,
        detail: true,
        group: 'supplementary',
      },
      {
        key: 'maxSharpEnergy',
        name: '锐能上限',
        value: '—',
        detail: true,
        group: 'resource',
      },
    ],
  }
}

export function createAnomalyRankingData(): GoldenTop10Data {
  const candidate: GoldenTop10Data['baseline'] = {
    rank: 1,
    label: '异常候选',
    fit: '100',
    panel: '',
    sets: '主套甲',
    effective: '12',
    swaps: 1,
    conflict: '',
    cost: '',
    staticDps: null,
    statDeltaSummary: '',
    finalStats: {},
    discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
  }
  return {
    agentName: '异常测试',
    baseline: { ...candidate, rank: 0 },
    candidates: [candidate],
    discs: workbench.discs,
    coreStats: [],
    allStats: [],
    statPresentation: 'disc_contribution',
    candidateSearch: {
      rankingMethod: 'dynamic_objective',
      status: 'complete',
      nodes: 1,
      evaluations: 1,
      exactWithinDeclaredModel: false,
      productionGameAccuracyCertified: false,
    },
    candidateSearchByRank: {
      1: {
        rankingMethod: 'prepared_anomaly_settlement',
        status: 'budget_exhausted',
        nodes: 30000,
        evaluations: 384,
        exactWithinDeclaredModel: false,
        productionGameAccuracyCertified: false,
      },
    },
  }
}

export function createLegacyReferenceData(): GoldenTop10Data {
  const baseline: GoldenTop10Data['baseline'] = {
    rank: 0,
    label: '当前实装',
    fit: '比较基准',
    panel: '当前方案',
    sets: '未录入',
    effective: '—',
    swaps: null,
    conflict: '待核对',
    cost: '—',
    staticDps: null,
    statDeltaSummary: '—',
    finalStats: { hp: 8020, def: 630, atk: 2800 },
  }
  return {
    agentName: '测试',
    baseline,
    candidates: [],
    discs: [],
    coreStats: [],
    statPresentation: 'static_panel',
    allStats: [
      { key: 'hp', label: '生命值', unit: '', highlight: false, target: '9500+（可选）' },
      { key: 'def', label: '防御力', unit: '', highlight: false, target: '750+（战斗内）' },
      { key: 'atk', label: '攻击力', unit: '', highlight: true, target: '3000+' },
    ],
  }
}
