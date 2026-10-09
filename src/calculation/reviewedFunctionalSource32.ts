import { canonicalJson, sha256 } from '../application/contentHash'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'

const commit = '3456cd0f6f5bea10e168074502460dac2fcd6df4'
const bindings = {
  'agent-dialyn': {
    key: 'Dialyn',
    formulaSha256: 'AA6BA963833BFFC7B82C29A6EF227209E80FCD57E7FF98F6AAD2055ACA68982C',
    parameters: ['dm.core.impact', 'dm.core.crit_threshold', 'dm.core.max_impact'],
    parametersSha256: 'ad1e4655e08acfcbc0ccb57238a5f4f1f227e96e9a4a1b58b1339069e95b4371',
  },
  'agent-seth': {
    key: 'Seth',
    formulaSha256: '499F9B3BE93358AE03618096258CC6FCB1E95E3AEEAE4052F27C3DEF436FDCD6',
    parameters: ['dm.core.shield', 'dm.core.max_shield', 'dm.m1.shield_'],
    parametersSha256: 'bbcff3045e010688bee493f4b072405126867e46f9e3780cd5e6b23d760d3ab3',
  },
  'agent-caesar': {
    key: 'Caesar',
    formulaSha256: '3F8882797C2D056CB9548B431209D6535C1B4BB3E3435D305C3C970EAF241125',
    parameters: ['dm.core.shield_', 'dm.core.shield'],
    parametersSha256: '94c5ec53857b26f6f76224963691905f0fcce69cec07fdf01d951c9cf53d0fa4',
  },
} as const

/** Formula and independently selected DM fields are both pinned; no copied growth table. */
export function bindReviewedFunctionalSource32(agentId: keyof typeof bindings) {
  const binding = bindings[agentId]
  const contract = getCurrentAgentDecisionMechanicContract(agentId)
  const references: Readonly<Record<string, unknown>> =
    contract?.effectContract.runtimeDefaults.references ?? {}
  const parameters = Object.fromEntries(binding.parameters.map((key) => [key, references[key]]))
  const source = contract?.effectContract.source
  if (
    !source ||
    source.commit !== commit ||
    source.formulaPath !== `libs/zzz/formula/src/data/char/sheets/${binding.key}.ts` ||
    source.formulaSha256 !== binding.formulaSha256 ||
    sha256(canonicalJson(parameters)) !== binding.parametersSha256
  )
    return { status: 'unsupported' as const, blockers: [`功能来源或参数漂移：${agentId}`] }
  return {
    status: 'supported' as const,
    references,
    source,
    sourceRefs: [`${source.formulaPath}#${source.formulaSha256}`, `source-commit:${commit}`],
  }
}
