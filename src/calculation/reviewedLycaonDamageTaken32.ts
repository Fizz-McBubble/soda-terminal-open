import { canonicalJson, sha256 } from '../application/contentHash'
import encyclopedia from '../gameDataPacks/data/current-encyclopedia-display.3.3.json'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { UpstreamExpressionIR } from './currentUpstreamExpressionIR'

export const reviewedLycaonDamageTakenIdentity32 = Object.freeze({
  revision: 'lycaon-awakened-other-attribute-vulnerability-not-resistance-r1',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaPath: 'libs/zzz/formula/src/data/char/sheets/Lycaon.ts',
  formulaSha256: '693E61F9CF5C463C1BDAE3F655052691275C8CB60AD50D5F7EB43EF09E4300D9',
  textUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1141.json',
  textSha256: 'e2dad919185af7adf16c4589ead1719e598724abf879e193bc32595745732db3',
  locator: 'core[level=7,potentialIds=114100..114105]: first effect; EX/Assist Follow-Up hit, 30s',
  nonIceValue: 0.3,
  iceResistanceReduction: 0.25,
  minimumPotential: 1,
})
const pins: Record<string, readonly [string, string]> = {
  core_ice_resRed_: [
    '475BB690B150F7935EB2F521890F02E5B1382127BEDA2BA1E6D742FF6FB17403',
    '8dfb1eb0e8b7a83cc6f31b94aa7571a6a022c9d178d9b6c14d39c8ee8fce24b4',
  ],
  core_ether_resRed_: [
    '545F7C82E10FEF32B94A7DD85F2A4CF46A44C7FC3148E8552DCB9C3BBED7A0E2',
    '9f1afd5c2bad9ba95dcbfd71c6780a27f572c09c465a06066f3526efc35712a9',
  ],
  core_electric_resRed_: [
    '1D8C99295E613A96DF9E509C9FA9CC335B2F04DF6E2383491812B8512068D8BD',
    'fbfc5e7effe9a940e24a8d7522f6aea2afc84b16823273ca625040aed9cc10d1',
  ],
  core_fire_resRed_: [
    '2CC12124319EC6CD2D82E944EDAA211BC53B482D696FAC1F464AA005B36AD638',
    'a8b2213d0babe70953a9d6caa1676ea354ee811f6a88f4923ee01a4d299e4d58',
  ],
  core_physical_resRed_: [
    '4101CD0F9CCC2E9A01E81D1DA2772A370AD6806C99E8F7818F2A8C8DF1D6C253',
    '62b8568cdef50bed0bc13a4d7f805b6cce562874fae3b1fefd48ab5eccf8d46a',
  ],
}
const source = reviewedLycaonDamageTakenIdentity32
const lit = (value: number): UpstreamExpressionIR => ({ kind: 'literal', value })
const ref = (path: string): UpstreamExpressionIR => ({ kind: 'reference', path })

/** The upstream names/keys are retained for existing source references. Only
 * its receiver is corrected. Ice remains -25% RES; other attributes receive
 * +30% damage taken, gated by actual awakening and the explicit hit state.
 * Qualified combat receivers preserve event attribute through all consumers. */
export function reconcileReviewedLycaonDamageTaken32(
  entry: CurrentAgentPlanningEffectBlueprint,
): CurrentAgentPlanningEffectBlueprint {
  const pin = entry.providerAgentId === 'agent-lycaon' ? pins[entry.effectId] : undefined
  if (!pin) return entry
  const current = encyclopedia.agents.find((row) => row.stableId === 'agent-lycaon')
  const original = entry.numericExpression.expressionIr
  const originalIrSha256 = sha256(canonicalJson(original))
  if (
    current?.source.sha256 !== source.textSha256 ||
    entry.numericExpression.expressionSha256 !== pin[0] ||
    originalIrSha256 !== pin[1] ||
    !entry.sourceRefs.includes(`${source.formulaPath}#${source.formulaSha256}`) ||
    !entry.sourceRefs.includes(`https://github.com/frzyc/genshin-optimizer@${source.commit}`) ||
    original.kind !== 'call' ||
    original.operator !== 'add' ||
    original.arguments.length !== 1
  )
    return {
      ...entry,
      numericExpression: {
        ...entry.numericExpression,
        todoBoundary: 'reconciliation_drift:lycaon_damage_taken_source_changed',
      },
    }
  const attribute = entry.effectId.split('_')[1]!
  const ice = attribute === 'ice'
  const value: UpstreamExpressionIR = ice
    ? original.arguments[0]!
    : {
        kind: 'call',
        operator: 'cmpGE',
        arguments: [
          ref('char.potential'),
          lit(1),
          {
            kind: 'call',
            operator: 'ifOn',
            receiver: ref('exSpecial_assistFollowUp_hit'),
            arguments: [lit(0.3)],
          },
          lit(0),
        ],
      }
  const expressionIr: UpstreamExpressionIR = {
    kind: 'call',
    operator: 'add',
    receiver: ref(`enemyDebuff.combat.${ice ? 'resRed_' : 'dmgInc_'}.${attribute}`),
    arguments: [value],
  }
  return {
    ...entry,
    numericExpression: {
      ...entry.numericExpression,
      expressionIr,
      expressionSha256: sha256(canonicalJson(expressionIr)),
      operators: [
        ...new Set([...entry.numericExpression.operators, ...(ice ? [] : ['cmpGE', 'ifOn'])]),
      ],
      dependencyKinds: [
        ...new Set([
          ...entry.numericExpression.dependencyKinds,
          ...(ice ? [] : ['character_state', 'literal']),
        ]),
      ],
      originalSource: {
        formulaSha256: source.formulaSha256,
        expressionSha256: pin[0],
        expressionIrSha256: pin[1],
      },
    },
    sourceRefs: [
      ...entry.sourceRefs,
      `${source.textUrl}#sha256=${source.textSha256}`,
      source.locator,
      source.revision,
    ],
  }
}

/** Wind is included by the source's "other attributes" wording. The captured
 * older optimizer enumerated only four non-Ice channels. Derive the extra
 * channel only from a successfully reconciled, source-pinned sibling. */
export function reviewedLycaonWindDamageTaken32(
  entries: readonly CurrentAgentPlanningEffectBlueprint[],
): CurrentAgentPlanningEffectBlueprint[] {
  const sibling = entries.find((entry) => entry.effectKey === 'agent-lycaon:core_electric_resRed_')
  if (
    !sibling ||
    !sibling.sourceRefs.includes(source.revision) ||
    sibling.numericExpression.todoBoundary?.startsWith('reconciliation_drift:')
  )
    return []
  const original = sibling.numericExpression.expressionIr
  if (original.kind !== 'call') return []
  const expressionIr: UpstreamExpressionIR = {
    ...original,
    receiver: ref('enemyDebuff.combat.dmgInc_.wind'),
  }
  return [
    {
      ...sibling,
      effectKey: 'agent-lycaon:reviewed_core_wind_damage_taken',
      effectId: 'reviewed_core_wind_damage_taken',
      numericExpression: {
        ...sibling.numericExpression,
        expressionIr,
        expressionSha256: sha256(canonicalJson(expressionIr)),
      },
    },
  ]
}
