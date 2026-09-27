import { accountIdSchema, type AccountProfile } from '../accounts/types'

export const scannerTargetAccountBindingStorageKey = 'soda-scanner-target-account-v1'
export const scannerTargetAccountBindingSchemaVersion = 1

export type ScannerTargetAccountBinding = {
  schemaVersion: typeof scannerTargetAccountBindingSchemaVersion
  bindingId: string
  accountId: string
  displayName: string
  operation: 'replace_drive_discs'
  baselineDiscCount: number
  createdAt: string
  checksum: string
}

export type ScannerTargetBindingValidation =
  | { valid: true; binding: ScannerTargetAccountBinding }
  | {
      valid: false
      code:
        | 'binding_missing'
        | 'binding_invalid'
        | 'binding_tampered'
        | 'target_account_missing'
        | 'target_account_changed'
        | 'active_account_changed'
        | 'baseline_changed'
      message: string
    }

type BindingPayload = Omit<ScannerTargetAccountBinding, 'checksum'>

function payloadIdentity(payload: BindingPayload) {
  return [
    payload.schemaVersion,
    payload.bindingId,
    payload.accountId,
    payload.displayName,
    payload.operation,
    payload.baselineDiscCount,
    payload.createdAt,
  ].join('\u001f')
}

function checksum(payload: BindingPayload) {
  let hash = 0x811c9dc5
  for (const character of payloadIdentity(payload)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function isBindingPayload(value: unknown): value is BindingPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BindingPayload>
  return (
    candidate.schemaVersion === scannerTargetAccountBindingSchemaVersion &&
    typeof candidate.bindingId === 'string' &&
    candidate.bindingId.length >= 8 &&
    accountIdSchema.safeParse(candidate.accountId).success &&
    typeof candidate.displayName === 'string' &&
    Boolean(candidate.displayName.trim()) &&
    candidate.displayName.length <= 40 &&
    candidate.operation === 'replace_drive_discs' &&
    Number.isInteger(candidate.baselineDiscCount) &&
    Number(candidate.baselineDiscCount) >= 0 &&
    typeof candidate.createdAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.createdAt))
  )
}

export function createScannerTargetAccountBinding(input: {
  account: Pick<AccountProfile, 'id' | 'displayName'>
  baselineDiscCount: number
  bindingId?: string
  createdAt?: string
}): ScannerTargetAccountBinding {
  const payload: BindingPayload = {
    schemaVersion: scannerTargetAccountBindingSchemaVersion,
    bindingId: input.bindingId ?? crypto.randomUUID(),
    accountId: accountIdSchema.parse(input.account.id),
    displayName: input.account.displayName.trim(),
    operation: 'replace_drive_discs',
    baselineDiscCount: input.baselineDiscCount,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
  if (!isBindingPayload(payload)) throw new Error('扫描目标账户资料不完整。')
  return { ...payload, checksum: checksum(payload) }
}

export function saveScannerTargetAccountBinding(
  binding: ScannerTargetAccountBinding,
  storage: Pick<Storage, 'setItem'> = sessionStorage,
) {
  storage.setItem(scannerTargetAccountBindingStorageKey, JSON.stringify(binding))
}

export function clearScannerTargetAccountBinding(
  storage: Pick<Storage, 'removeItem'> = sessionStorage,
) {
  storage.removeItem(scannerTargetAccountBindingStorageKey)
}

export function readScannerTargetAccountBinding(
  storage: Pick<Storage, 'getItem'> = sessionStorage,
): ScannerTargetBindingValidation {
  const serialized = storage.getItem(scannerTargetAccountBindingStorageKey)
  if (!serialized)
    return {
      valid: false,
      code: 'binding_missing',
      message: '本次扫描尚未选择目标账户，请返回扫描页重新确认。',
    }
  try {
    const parsed = JSON.parse(serialized) as unknown
    if (
      !isBindingPayload(parsed) ||
      typeof (parsed as { checksum?: unknown }).checksum !== 'string'
    )
      return {
        valid: false,
        code: 'binding_invalid',
        message: '扫描目标账户资料不完整，请返回扫描页重新确认。',
      }
    const binding = parsed as ScannerTargetAccountBinding
    const { checksum: storedChecksum, ...payload } = binding
    if (storedChecksum !== checksum(payload))
      return {
        valid: false,
        code: 'binding_tampered',
        message: '扫描目标账户资料校验失败，请返回扫描页重新确认。',
      }
    return { valid: true, binding }
  } catch {
    return {
      valid: false,
      code: 'binding_invalid',
      message: '扫描目标账户资料无法读取，请返回扫描页重新确认。',
    }
  }
}

export function validateScannerTargetAccountBinding(input: {
  binding: ScannerTargetAccountBinding
  targetAccount: Pick<AccountProfile, 'id' | 'displayName' | 'status'> | null
  activeAccount: Pick<AccountProfile, 'id'> | null
  currentDiscCount: number
}): ScannerTargetBindingValidation {
  if (!input.targetAccount || input.targetAccount.status !== 'active')
    return {
      valid: false,
      code: 'target_account_missing',
      message: '扫描目标账户已不存在或不可用，请返回扫描页重新确认。',
    }
  if (
    input.targetAccount.id !== input.binding.accountId ||
    input.targetAccount.displayName !== input.binding.displayName
  )
    return {
      valid: false,
      code: 'target_account_changed',
      message: '扫描目标账户资料已变化，请返回扫描页重新确认。',
    }
  if (input.activeAccount?.id !== input.binding.accountId)
    return {
      valid: false,
      code: 'active_account_changed',
      message: '当前账户已切换，本次扫描不会转交导入；请返回扫描页重新确认。',
    }
  if (input.currentDiscCount !== input.binding.baselineDiscCount)
    return {
      valid: false,
      code: 'baseline_changed',
      message: '目标账户的驱动盘仓库已变化，请返回扫描页重新确认后再扫描。',
    }
  return { valid: true, binding: input.binding }
}
