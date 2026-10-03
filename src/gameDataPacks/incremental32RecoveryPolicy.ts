/** Build-time compatibility recovery. Storage and released identities remain intact. */
export const incremental32RecoveryPolicy = Object.freeze({
  id: 'incremental-32-compatibility-recovery-v1',
  enabled: import.meta.env.VITE_SODA_INCREMENTAL32_RECOVERY === 'true',
  preservesReleasedIdentities: true,
  preservesAccountAndSavedPlans: true,
  disabledCapabilityScope: '3.2_precision_only',
  capabilityIdentity: incremental32AffectedCapabilityIdentity,
  previousResults: 'requires_reanalysis',
})

export const incremental32RecoveryReason =
  '兼容恢复版本已暂停3.2精算；账户、身份与保存方案保留，旧结果须重新分析。'
import { incremental32AffectedCapabilityIdentity } from './incremental32AffectedCapabilities'
