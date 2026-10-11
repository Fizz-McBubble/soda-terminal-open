import { describe, expect, it } from 'vitest'
import { getCurrentBuildAuthorityProfile } from './currentBuildAuthority'
import { resolveBuildIntentWEngineIds } from './buildIntentWEngineIdentity'
import { getCandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import { gameData32BuildGuidance, gameData32BuildSources } from './gameData32BuildGuidance'

describe('3.2 scoped source closeout reaches current consumers', () => {
  it('resolves the original alternative names to current W-Engine identities and retains conditions', () => {
    const field = getCurrentBuildAuthorityProfile('agent-roxy')!.guidance.fields.find(
      (row) => row.fieldId === 'build.wengines',
    )!
    expect(field.state).toBe('ready')
    expect(resolveBuildIntentWEngineIds('agent-roxy', field.value as string[])).toEqual([
      'wengine-14162',
      'wengine-13005',
      'wengine-14110',
    ])
    const conditions = field.conditions.join(' ')
    expect(conditions).toContain('人为刀俎')
    expect(conditions).toContain('满精')
    expect(conditions).toContain('80点能量')
    expect(conditions).toContain('燃狱齿轮')
    expect(conditions).toContain('1阶')
    expect(conditions).toContain('猩红渴望克拉蕾')
    expect(conditions).toContain('啜泣摇篮丽娜')
    expect(field.sourceRefs).toContainEqual(
      expect.objectContaining({
        id: 'prydwen-roxy32-alternatives-20261011',
        checkedAt: '2026-10-11',
      }),
    )
  })

  it.each(['agent-claret', 'agent-roxy'])(
    'retains source Bangboo candidate with exact team boundary for %s',
    (agentId) => {
      const field = getCurrentBuildAuthorityProfile(agentId)!.guidance.fields.find(
        (row) => row.fieldId === 'build.team_bangboo_scenario',
      )!
      expect(field.state).toBe('ready')
      const text = (field.value as string[]).join(' ')
      expect(text).toContain('克拉蕾 + 洛克茜 + 丽娜')
      expect(text).toContain('超极杰克')
      expect(text).toContain('仅用于该三人场景')
      expect(text).toContain('需另行核对阵营额外能力')
      expect(text).toContain('不设自动默认')
      expect(field.sourceRefs).toContainEqual(
        expect.objectContaining({
          id: 'zzzgg-roxy32-bangboo-20261011',
        }),
      )
      expect(
        getCandidateWarehouseConstraint(agentId)!.teamAndBangbooPreconditions.join(' '),
      ).toContain('超极杰克')
    },
  )

  it('does not turn missing Miyoushe originals or fixed-cycle evidence into adopted sources', () => {
    for (const guide of Object.values(gameData32BuildGuidance)) {
      expect(
        guide.sourceKeys.map((key) => gameData32BuildSources[key]!.url).join(' '),
      ).not.toContain('miyoushe')
      expect(guide.fixedCycleMissingFields).toContain('周期结束资源守恒及下一周期可重复性')
    }
    expect(gameData32BuildGuidance['agent-roxy']!.fixedCycleStatus).toBe('missing')
  })
})
