/* eslint-disable react-refresh/only-export-components */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentDevelopmentGolden } from './AgentDevelopmentGolden'
import type { GoldenTop10Data, GoldenWorkbenchData } from './types'

const workbench: GoldenWorkbenchData = {
  agentId: 'agent-billy',
  name: '比利',
  rarity: 'A',
  specialty: '强攻',
  level: 60,
  mindscape: 0,
  supportsPotential: false,
  engine: { name: '星徽引擎', detail: '当前实际', options: [] },
  skills: [
    ['普', '普攻'],
    ['闪', '闪避'],
    ['支', '支援'],
    ['特', '特殊'],
    ['连', '连携'],
    ['核', '核心'],
  ].map(([short, label]) => ({ short, label, value: 12 })),
  hasComparablePlan: true,
  candidatePlanCount: 3,
  selectedCandidateRank: 2,
  graduation: {
    skills: [{ label: '普攻', recommended: '12级', priority: true }],
    skillPriority: ['普攻'],
    panel: [{ name: '攻击力', value: '3000' }],
    teams: [],
    engines: [],
    discs: { sets: [], mainStats: [], subStats: '攻击力%' },
  },
  decisionGuide: {
    status: 'recommendation',
    recommendation: '推荐',
    accountFacts: '当前',
    coverage: [],
    gaps: [],
    evidence: [],
    gapDisposition: 'existing_evidence_unresolved',
  },
  panelFacts: [{ name: '攻击力', value: '3000' }],
  currentPanel: { availability: 'available', summary: '当前面板' },
  warehouseAnalysis: {
    status: 'ready',
    summary: '已生成',
    totalScore: 100,
    effectiveEnhancements: 12,
    replacementCount: 2,
  },
  discSource: '仓库候选',
  discs: Array.from({ length: 6 }, (_, index) => ({
    id: `disc-${index + 1}`,
    label: `${index + 1}号位`,
    slot: index + 1,
    set: '啄木鸟电音',
    image: null,
    level: 15,
    main: '攻击力%',
    mainValue: '当前方案',
    subs: [],
    effective: '2次',
    grade: 'A',
  })),
}

const unavailableTop10: GoldenTop10Data = {
  agentName: '比利',
  baseline: {
    rank: 0,
    label: '当前装备',
    fit: '比较基准',
    panel: '当前方案',
    sets: '未录入',
    effective: '—',
    swaps: null,
    conflict: '待核对',
    cost: '—',
    staticDps: null,
    statDeltaSummary: '—',
    finalStats: {},
  },
  candidates: [],
  discs: [],
  coreStats: [],
  allStats: [],
  statPresentation: 'disc_contribution',
  baselineAvailability: 'unavailable',
}

export {
  act,
  render,
  screen,
  waitFor,
  userEvent,
  describe,
  expect,
  it,
  vi,
  AgentDevelopmentGolden,
  workbench,
  unavailableTop10,
}
export type { GoldenTop10Data, GoldenWorkbenchData }
