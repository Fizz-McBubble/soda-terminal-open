import {
  gameData33ProviderManifestSha256,
  gameData33SourceDeltaSha256,
} from './gameData33CatalogEntities'

/** Code and data must be shipped together; a package-only rollback is unsafe.
 * Account identities and saved plans survive compatibility recovery. */
export const incremental33RecoveryPolicy = Object.freeze({
  id: 'incremental-33-compatibility-recovery-v1',
  enabled: import.meta.env?.VITE_SODA_INCREMENTAL33_RECOVERY === 'true',
  preservesReleasedIdentities: true,
  preservesAccountAndSavedPlans: true,
  disabledCapabilityScope: '3.3_precision_only',
  capabilityIdentity: {
    provider: 'nanoka',
    providerManifestSha256: gameData33ProviderManifestSha256,
    deltaSha256: gameData33SourceDeltaSha256,
    adoptedStableIds: ['agent-phoenix', 'wengine-14164'],
  },
  previousResults: 'requires_reanalysis',
})

export const incremental33RecoveryReason =
  '兼容恢复版本已暂停3.3精算；账户、身份与保存方案保留，旧结果须重新分析。'

export function usesIncremental33Capabilities(input: {
  members: readonly { agentId: string }[]
  equipmentIds?: readonly string[]
  equipmentEffects?: readonly { effectKey: string; sourceFormula?: { engineId: string } }[]
}) {
  return (
    input.members.some((member) => member.agentId === 'agent-phoenix') ||
    input.equipmentIds?.includes('wengine-14164') === true ||
    input.equipmentEffects?.some(
      (effect) =>
        effect.sourceFormula?.engineId === 'wengine-14164' ||
        effect.effectKey.startsWith('wengine:wengine-14164:'),
    ) === true
  )
}
