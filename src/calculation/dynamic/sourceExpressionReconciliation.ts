import { canonical } from './numeric'

export const sourceReconciliationVersion = 'source-text-bound-initial-stat-reconciliation-r1'
export const PINNED_SOURCE_COMMIT = '3456cd0f6f5bea10e168074502460dac2fcd6df4'

const lighterQualifiedDamageIr = {
  kind: 'call',
  operator: 'prod',
  arguments: [
    {
      kind: 'call',
      operator: 'min',
      arguments: [
        { kind: 'reference', path: 'dm.ability.max_ice_fire_dmg_' },
        {
          kind: 'call',
          operator: 'prod',
          arguments: [
            { kind: 'reference', path: 'elation' },
            {
              kind: 'call',
              operator: 'sum',
              arguments: [
                { kind: 'reference', path: 'dm.ability.ice_fire_dmg_' },
                {
                  kind: 'call',
                  operator: 'prod',
                  arguments: [
                    {
                      kind: 'call',
                      operator: 'max',
                      arguments: [
                        { kind: 'literal', value: 0 },
                        {
                          kind: 'call',
                          operator: 'sum',
                          arguments: [
                            { kind: 'reference', path: 'own.final.impact' },
                            {
                              kind: 'call',
                              operator: 'negate',
                              arguments: [
                                { kind: 'reference', path: 'dm.ability.impact_threshold' },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      kind: 'call',
                      operator: 'binary:/',
                      arguments: [
                        { kind: 'literal', value: 1 },
                        { kind: 'reference', path: 'dm.ability.impact_step' },
                      ],
                    },
                    { kind: 'reference', path: 'dm.ability.extra_ice_fire_dmg_' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      kind: 'call',
      operator: 'cmpGE',
      arguments: [
        { kind: 'reference', path: 'char.mindscape' },
        { kind: 'literal', value: 2 },
        { kind: 'reference', path: 'dm.m2.ability_buff_inc_' },
        { kind: 'literal', value: 1 },
      ],
    },
  ],
}

// The source alias includes the actual team-count gate; expanding only its
// numeric branch would incorrectly activate an unqualified formation.
export const lighterResolvedAbilityDmgIr = Object.freeze({
  kind: 'call',
  operator: 'cmpGE',
  arguments: [
    {
      kind: 'call',
      operator: 'sum',
      arguments: [
        {
          kind: 'call',
          operator: 'withSpecialty',
          receiver: { kind: 'reference', path: 'team.common.count' },
          arguments: [{ kind: 'literal', value: 'attack' }],
        },
        {
          kind: 'call',
          operator: 'withFaction',
          receiver: { kind: 'reference', path: 'team.common.count' },
          arguments: [{ kind: 'literal', value: 'SonsOfCalydon' }],
        },
      ],
    },
    { kind: 'literal', value: 2 },
    lighterQualifiedDamageIr,
  ],
})

interface ReconciliationTargetConfig {
  agentId: string
  effectId: string
  targetPath: string
  sourceRef: string
  correctedRef?: string
  replacementIr?: unknown
  evidence: string[]
  prefix: string
  formulaSha256?: string
  expressionSha256?: string
  originalIrSha256?: string
}

const RECONCILIATION_TARGETS: ReconciliationTargetConfig[] = [
  {
    agentId: 'agent-pan-yinhu',
    effectId: 'core_sheerForce',
    targetPath: 'libs/zzz/formula/src/data/char/sheets/PanYinhu.ts',
    sourceRef: 'own.final.atk',
    correctedRef: 'own.initial.atk',
    evidence: [
      `frzyc/genshin-optimizer@${PINNED_SOURCE_COMMIT}:libs/zzz/dm-localization/assets/locales/en/char_PanYinhu_gen.json:core,m6`,
      'git-blob:21ca6cc14f94b8917f1e833b77e2e07bd41dfe60',
      sourceReconciliationVersion,
    ],
    prefix: 'pan_core',
    formulaSha256: 'CF1E27AAA6504E5C4150961E397FE93DB293FCEA2D6AE2470A600217F00228B5',
    expressionSha256: 'B4338ECEB9051255EB2CD4403D69E9A57C05ED6704E39919CE787A2EBCC9DE2B',
    originalIrSha256: '093e857cc3a20e3e087a279e046ec5b5acee463cc48aeff23333c92fc10e399f',
  },
  {
    agentId: 'agent-ju-fufu',
    effectId: 'core_crit_dmg_',
    targetPath: 'libs/zzz/formula/src/data/char/sheets/JuFufu.ts',
    sourceRef: 'own.final.atk',
    correctedRef: 'own.initial.atk',
    evidence: [
      `frzyc/genshin-optimizer@${PINNED_SOURCE_COMMIT}:libs/zzz/dm-localization/assets/locales/en/char_JuFufu_gen.json:core.desc[6][1]`,
      'git-blob:d90b343a85ab49e3fad5c1007fc71ec093de077d',
      sourceReconciliationVersion,
    ],
    prefix: 'jufufu_core',
    formulaSha256: 'AD33CBC292233EA3D57921C0667CC327F368876133A7C29D76D8917E8D6C3B51',
    expressionSha256: '18DD97D83A91BA783241AFABD42296932DD5B3272FB263025592FBA7614C4325',
    originalIrSha256: '2112525bc5069fd153bf50e5bd0845205ef3944d0130c13dc74b312e0329b366',
  },
  {
    agentId: 'agent-dialyn',
    effectId: 'core_impact',
    targetPath: 'libs/zzz/formula/src/data/char/sheets/Dialyn.ts',
    sourceRef: 'own.final.crit_',
    correctedRef: 'own.initial.crit_',
    evidence: [
      `frzyc/genshin-optimizer@${PINNED_SOURCE_COMMIT}:libs/zzz/dm-localization/assets/locales/en/char_Dialyn_gen.json:core.desc[6][0]`,
      'git-blob:c317dbcd293e1a9e79d78c34880ee4db13c209d0',
      sourceReconciliationVersion,
    ],
    prefix: 'dialyn_core',
    formulaSha256: 'AA6BA963833BFFC7B82C29A6EF227209E80FCD57E7FF98F6AAD2055ACA68982C',
    expressionSha256: '0D38CB711B3B37ACAEB71ABB9664A744E2677736D9BF056AF3515CD9DA7DBC35',
    originalIrSha256: '636be9d7dd9f5930725f51c7e7983c723b004253c9853cca2e0c80ab4e4adb2d',
  },
  {
    agentId: 'agent-lighter',
    effectId: 'ability_ice_dmg_',
    targetPath: 'libs/zzz/formula/src/data/char/sheets/Lighter.ts',
    sourceRef: 'ability_ice_fire_dmg_check',
    replacementIr: lighterResolvedAbilityDmgIr,
    evidence: [
      `frzyc/genshin-optimizer@${PINNED_SOURCE_COMMIT}:libs/zzz/formula/src/data/char/sheets/Lighter.ts:45-73`,
      'resolved-alias:ability_ice_fire_dmg_check',
      sourceReconciliationVersion,
    ],
    prefix: 'lighter_ability_ice',
    formulaSha256: '4AE8698C1FF65B9A4B56CF89024DF3CA9D3D9061912455A4FDBB6F977938182A',
    expressionSha256: 'AE14098403121F323A4B427E8EE0E561E5B82BD09C2462643C9C93D59539EB8B',
    originalIrSha256: '4846587801dd0736d3a2cba0359c47b0711996b55f40a37cb768644d32c1a361',
  },
  {
    agentId: 'agent-lighter',
    effectId: 'ability_fire_dmg_',
    targetPath: 'libs/zzz/formula/src/data/char/sheets/Lighter.ts',
    sourceRef: 'ability_ice_fire_dmg_check',
    replacementIr: lighterResolvedAbilityDmgIr,
    evidence: [
      `frzyc/genshin-optimizer@${PINNED_SOURCE_COMMIT}:libs/zzz/formula/src/data/char/sheets/Lighter.ts:45-73`,
      'resolved-alias:ability_ice_fire_dmg_check',
      sourceReconciliationVersion,
    ],
    prefix: 'lighter_ability_fire',
    formulaSha256: '4AE8698C1FF65B9A4B56CF89024DF3CA9D3D9061912455A4FDBB6F977938182A',
    expressionSha256: 'EFB46C9609C63800B0DFCF2A5D14C321C3C7C8EE4CA6F09B201A7B1F69F4032E',
    originalIrSha256: '2d487d4319a5ccee82522c1a42ba8b75e02baa55227acda0858fdf550f16a99e',
  },
]

/** Narrow source correction and intermediate expansion, not a general rewrite.
 * - Pan, Ju Fufu, Dialyn core effects require initial stats per source text.
 * - Lighter ability effects expand the intermediate variable ability_ice_fire_dmg_check.
 * Callers hash this effective expression separately and keep original provenance.
 * Changed source pins fail closed.
 */
export function reconcileSourceExpression<T>(input: {
  agentId: string
  effectId: string
  sourceCommit: string
  sourcePath: string
  expression: T
}): {
  expression: T
  applied: boolean
  evidence: string[]
  identity: string | null
} {
  const config = RECONCILIATION_TARGETS.find(
    (target) => target.agentId === input.agentId && target.effectId === input.effectId,
  )
  if (!config) {
    return {
      expression: input.expression,
      applied: false,
      evidence: [] as string[],
      identity: null,
    }
  }

  if (input.sourceCommit !== PINNED_SOURCE_COMMIT || input.sourcePath !== config.targetPath) {
    throw new Error(`${config.prefix}_reconciliation_source_changed`)
  }

  let changed = 0
  let alreadyCorrected = 0

  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk)
    if (x === null || typeof x !== 'object') return x
    const n = x as Record<string, unknown>

    if (n.kind === 'reference' && n.path === config.sourceRef) {
      changed++
      if (config.replacementIr !== undefined) {
        return JSON.parse(JSON.stringify(config.replacementIr))
      }
      return { ...n, path: config.correctedRef }
    }

    if (config.correctedRef && n.kind === 'reference' && n.path === config.correctedRef) {
      alreadyCorrected++
    }

    return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, walk(v)]))
  }

  const expression = walk(input.expression) as T

  if (changed !== 1 || alreadyCorrected !== 0) {
    throw new Error(`${config.prefix}_reconciliation_shape_changed`)
  }

  const evidence = [...config.evidence]
  const identity = canonical({
    version: sourceReconciliationVersion,
    source: input.sourceCommit,
    original: input.expression,
    corrected: expression,
    evidence,
  })

  return { expression, applied: true, evidence, identity }
}

/** Production validates both captured source metadata and the original IR
 * digest. The small pure rewrite API remains usable for isolated AST checks. */
export function reconcileProductionSourceExpression<T>(input: {
  agentId: string
  effectId: string
  sourceCommit: string
  sourcePath: string
  formulaSha256: string
  expressionSha256: string
  originalIrSha256: string
  expression: T
}) {
  const config = RECONCILIATION_TARGETS.find(
    (target) => target.agentId === input.agentId && target.effectId === input.effectId,
  )
  if (
    config &&
    (input.formulaSha256 !== config.formulaSha256 ||
      input.expressionSha256 !== config.expressionSha256 ||
      input.originalIrSha256 !== config.originalIrSha256)
  )
    throw new Error(`${config.prefix}_reconciliation_digest_changed`)
  return reconcileSourceExpression(input)
}
