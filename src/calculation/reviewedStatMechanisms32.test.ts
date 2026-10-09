import { afterEach, describe, expect, it, vi } from 'vitest'
import * as contracts from './currentAgentDecisionMechanicContracts'
import {
  compileAgentPlanningEffectBlueprints,
  getCurrentAgentPlanningEffectBlueprint,
  type CurrentAgentPlanningEffectBlueprint,
} from './currentAgentPlanningEffectBlueprint'
import {
  createLevel60NeutralEffectRuntimeMember,
  evaluateCurrentPlanningEffectEntries32,
} from './currentPlanningEffectRuntime'
import {
  getReviewedMechanismAdoptionSummary,
  reviewedStatMechanisms19,
} from './reviewedStatMechanisms32'
import {
  PINNED_SOURCE_COMMIT,
  reconcileSourceExpression,
} from './dynamic/sourceExpressionReconciliation'
import { canonicalJson, sha256 } from '../application/contentHash'

afterEach(() => vi.restoreAllMocks())

function runEffect(
  key: string,
  input: {
    initialAttack?: number
    combatAttack?: number
    initialCritRate?: number
    combatCritRate?: number
    combatImpact?: number
    mindscape?: number
    references?: Record<string, unknown>
    teammates?: string[]
    blueprint?: CurrentAgentPlanningEffectBlueprint
  } = {},
) {
  const agentId = key.split(':')[0]
  const member = createLevel60NeutralEffectRuntimeMember(agentId)
  member.coreLevel = 7
  member.mindscape = input.mindscape ?? 0
  member.initialStats = {
    ...member.initialStats,
    ...(input.initialAttack === undefined ? {} : { atk: input.initialAttack }),
    ...(input.initialCritRate === undefined ? {} : { crit_: input.initialCritRate }),
  }
  member.finalStats = {
    ...member.initialStats,
    ...(input.combatAttack === undefined ? {} : { atk: input.combatAttack }),
    ...(input.combatCritRate === undefined ? {} : { crit_: input.combatCritRate }),
    ...(input.combatImpact === undefined ? {} : { impact: input.combatImpact }),
  }
  const members = [
    member,
    ...(input.teammates ?? ['agent-lucy', 'agent-soldier-11']).map(
      createLevel60NeutralEffectRuntimeMember,
    ),
  ]
  const before = structuredClone(members)
  const result = evaluateCurrentPlanningEffectEntries32(
    {
      memberIds: members.map((row) => row.agentId),
      members,
      baselineReferencesByAgentId: { [agentId]: input.references ?? {} },
    },
    [input.blueprint ?? getCurrentAgentPlanningEffectBlueprint(key)!],
  )
  expect(members).toEqual(before)
  if (result.status !== 'supported') return result
  const row = result.results.find((entry) => entry.effectKey === key)
  if (!row) throw new Error('Missing effect')
  return row
}

function expectValue(row: ReturnType<typeof runEffect>, value: number) {
  expect(row.status).toBe('supported')
  if (row.status !== 'supported') throw new Error(JSON.stringify(row))
  expect(row.value).toBeCloseTo(value, 10)
}

describe('reviewed adoption and actual planning runtime', () => {
  it('keeps 19 source records with two unresolved shield contracts', () => {
    expect(getReviewedMechanismAdoptionSummary()).toEqual({
      total: 19,
      alreadyBound: 13,
      reconciledThisBatch: 3,
      resolvedIntermediateThisBatch: 1,
      pendingShieldContract: 2,
      sourceCommit: PINNED_SOURCE_COMMIT,
    })
    for (const item of reviewedStatMechanisms19.filter((row) => row.effectId !== null))
      expect(
        getCurrentAgentPlanningEffectBlueprint(`${item.agentId}:${item.effectId}`),
      ).not.toBeNull()
  })

  it('Pan reads initial 2800 with explicitly active Meridian Flow', () => {
    expectValue(
      runEffect('agent-pan-yinhu:core_sheerForce', {
        initialAttack: 2800,
        combatAttack: 4000,
        references: { meridian_flow: 1, panMeridianFlowIncomingAgentId32: 'agent-lucy' },
      }),
      504,
    ) // 2800 * .18; stale combat branch would yield 540.
    expectValue(
      runEffect('agent-pan-yinhu:core_sheerForce', {
        initialAttack: 3000,
        combatAttack: 4000,
        mindscape: 6,
        references: { meridian_flow: 1, panMeridianFlowIncomingAgentId32: 'agent-lucy' },
      }),
      720,
    ) // min(720, 3000 * (.18 + .06)).
    expectValue(
      runEffect('agent-pan-yinhu:core_sheerForce', {
        initialAttack: 2800,
        references: { meridian_flow: 0 },
      }),
      0,
    )
  })

  it('Ju Fufu reads initial 3000 with explicitly active Tigers Roar', () => {
    expectValue(
      runEffect('agent-ju-fufu:core_crit_dmg_', {
        initialAttack: 3000,
        combatAttack: 4000,
        references: { tigers_roar: 1 },
      }),
      0.3,
    ) // .20 + min(.30, (3000 - 2800) / 100 * .05).
    expectValue(
      runEffect('agent-ju-fufu:core_crit_dmg_', {
        initialAttack: 3000,
        references: { tigers_roar: 0 },
      }),
      0,
    )
  })

  it('Dialyn uses initial CR .60 instead of combat .80; keeps threshold/cap', () => {
    expectValue(
      runEffect('agent-dialyn:core_impact', { initialCritRate: 0.6, combatCritRate: 0.8 }),
      20,
    )
    // (.60 - .50) * 2 * 100; stale combat branch would yield 60.
    expectValue(runEffect('agent-dialyn:core_impact', { initialCritRate: 0.5 }), 0)
    expectValue(runEffect('agent-dialyn:core_impact', { initialCritRate: 1.1 }), 100)
  })

  it.each([
    [20, 270, 0, 0.75],
    [10, 270, 0, 0.375],
    [20, 270, 2, 0.9],
    [10, 420, 0, 0.75],
    [0, 270, 2, 0],
  ])(
    'Lighter uses real dm values: %s stacks, %s impact, M%s',
    (elation, combatImpact, mindscape, expected) => {
      for (const effectId of ['ability_fire_dmg_', 'ability_ice_dmg_'])
        expectValue(
          runEffect(`agent-lighter:${effectId}`, {
            combatImpact,
            mindscape,
            references: { elation },
          }),
          expected,
        )
      // min(.75, stacks * (.0125 + max(impact-170,0)/10*.0025)); M2 * 1.2.
    },
  )

  it('qualified Lighter needs observed stacks; closed team gate proves zero', () => {
    expect(runEffect('agent-lighter:ability_fire_dmg_', { combatImpact: 270 }).status).toBe(
      'unsupported',
    )
    expectValue(
      runEffect('agent-lighter:ability_fire_dmg_', {
        combatImpact: 270,
        teammates: ['agent-nicole', 'agent-anby'],
      }),
      0,
    )
    expectValue(
      runEffect('agent-lighter:ability_fire_dmg_', {
        combatImpact: 270,
        references: { elation: 20 },
        teammates: ['agent-nicole', 'agent-anby'],
      }),
      0,
    )
  })

  it.each([-1, 20.5, 21, NaN, Infinity])('rejects invalid Lighter stacks %s', (elation) => {
    expect(
      runEffect('agent-lighter:ability_fire_dmg_', { combatImpact: 270, references: { elation } })
        .status,
    ).toBe('unsupported')
  })

  it('keeps original source and effective hashes with expanded metadata', () => {
    for (const key of [
      'agent-pan-yinhu:core_sheerForce',
      'agent-ju-fufu:core_crit_dmg_',
      'agent-dialyn:core_impact',
      'agent-lighter:ability_fire_dmg_',
    ]) {
      const bp = getCurrentAgentPlanningEffectBlueprint(key)!
      expect(bp.numericExpression.todoBoundary).toBeNull()
      expect(bp.numericExpression.originalSource?.expressionSha256).not.toBe(
        bp.numericExpression.expressionSha256,
      )
      expect(bp.numericExpression.expressionSha256).toBe(
        sha256(canonicalJson(bp.numericExpression.expressionIr)),
      )
      expect(bp.sourceRefs.join(';')).toContain(bp.numericExpression.originalSource!.formulaSha256)
    }
    const bp = getCurrentAgentPlanningEffectBlueprint('agent-lighter:ability_fire_dmg_')!
    expect(bp.numericExpression.operators).toEqual(
      expect.arrayContaining(['withSpecialty', 'withFaction', 'cmpGE', 'binary:/']),
    )
    expect(bp.numericExpression.dependencyKinds).toEqual(
      expect.arrayContaining([
        'mapped_stat',
        'character_state',
        'conditional_state',
        'team_composition',
      ]),
    )
    expect(bp.numericExpression.requiredExplicitRuntimeReferences).toEqual(['elation'])
  })

  it.each(['formula', 'expression_metadata', 'expression_ir', 'commit', 'path'] as const)(
    'production blueprint rejects %s drift even with condition off',
    (drift) => {
      const original = contracts.getCurrentAgentDecisionMechanicContract('agent-pan-yinhu')!
      const captured = structuredClone(original)
      const effect = captured.effectContract.effects.find(
        (row) => row.effectId === 'core_sheerForce',
      )!
      if (drift === 'formula') captured.effectContract.source.formulaSha256 = 'changed'
      if (drift === 'expression_metadata') effect.numericExpression.expressionSha256 = 'changed'
      if (drift === 'expression_ir') {
        // Keep the single target reference while changing another source operand.
        const altered = JSON.stringify(effect.numericExpression.expressionIr).replace(
          '"value":6',
          '"value":5',
        )
        effect.numericExpression.expressionIr = JSON.parse(altered)
      }
      if (drift === 'commit') captured.effectContract.source.commit = 'changed'
      if (drift === 'path') captured.effectContract.source.formulaPath = 'changed'
      vi.spyOn(contracts, 'getCurrentAgentDecisionMechanicContract').mockImplementation((id) =>
        id === 'agent-pan-yinhu'
          ? captured
          : (contracts.currentAgentDecisionMechanicContracts.find((row) => row.agentId === id) ??
            null),
      )
      const blueprint = compileAgentPlanningEffectBlueprints('agent-pan-yinhu').find(
        (row) => row.effectId === 'core_sheerForce',
      )!
      expect(blueprint.numericExpression.todoBoundary).toContain('reconciliation_drift:')
      for (const meridian_flow of [0, 1])
        expect(
          runEffect(blueprint.effectKey, {
            initialAttack: 2800,
            references: { meridian_flow },
            blueprint,
          }).status,
        ).toBe('unsupported')
      expect(original).not.toEqual(captured)
    },
  )

  it('preserves the isolated pure AST API and immutable inputs', () => {
    const input = {
      agentId: 'agent-pan-yinhu',
      effectId: 'core_sheerForce',
      sourceCommit: PINNED_SOURCE_COMMIT,
      sourcePath: 'libs/zzz/formula/src/data/char/sheets/PanYinhu.ts',
      expression: { kind: 'reference', path: 'own.final.atk' },
    }
    const before = structuredClone(input)
    expect(reconcileSourceExpression(input).expression.path).toBe('own.initial.atk')
    expect(input).toEqual(before)
    expect(() => reconcileSourceExpression({ ...input, sourceCommit: 'changed' })).toThrow(
      /source_changed/,
    )
    expect(() =>
      reconcileSourceExpression({ ...input, expression: [input.expression, input.expression] }),
    ).toThrow(/shape_changed/)
  })
})
