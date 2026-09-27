export const n2AcceptanceAccountId = 'account-n2-product-review-57-400'
export const n2AcceptanceAccountName = 'N2 Product Review 57/400 验收账户'
export const n2AcceptanceRecoveryQuery = 'n2-product-review'

export async function isN2AcceptanceRecoveryAvailable(search: string) {
  if (new URLSearchParams(search).get('acceptance') !== n2AcceptanceRecoveryQuery) return false
  if (import.meta.env.DEV) return true
  try {
    const response = await fetch('/_soda/health', { cache: 'no-store' })
    if (!response.ok) return false
    const value = (await response.json()) as { ok?: boolean; runtime?: string }
    return value.ok === true && value.runtime === 'production-static/v1'
  } catch {
    return false
  }
}
