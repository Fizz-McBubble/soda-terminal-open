import { contentHash } from '../application/contentHash'
import {
  declaredLuminizeSettlementSchema32,
  type DeclaredLuminizeSettlement32,
} from '../calculation/luminizeSettlementContract32'
import { evaluateReviewedLuminizeSettlement32 } from '../calculation/reviewedLuminizeSettlement32'
import { reviewedLumifluxMechanicsHash32 } from '../calculation/reviewedLumifluxMechanics32'

import {
  savedDeclaredLuminizeSettlement32Contract,
  savedDeclaredLuminizeSettlement32Schema,
  type SavedDeclaredLuminizeSettlement32,
} from './luminizeSavedContract32'
export {
  savedDeclaredLuminizeSettlement32Contract,
  savedDeclaredLuminizeSettlement32Schema,
  type SavedDeclaredLuminizeSettlement32,
} from './luminizeSavedContract32'

export function createSavedDeclaredLuminizeSettlement32(
  raw: unknown,
): SavedDeclaredLuminizeSettlement32 {
  const declaration = declaredLuminizeSettlementSchema32.safeParse(raw)
  if (!declaration.success) throw new Error('Luminize 结算输入格式无效，不能保存。')
  const evaluated = evaluateReviewedLuminizeSettlement32(declaration.data)
  if (evaluated.status !== 'declared_arithmetic')
    throw new Error(
      `Luminize 结算尚未闭合：${evaluated.blockers.join(', ') || '当前来源不受支持'}。`,
    )
  const body = {
    contract: savedDeclaredLuminizeSettlement32Contract,
    declaration: declaration.data,
  }
  return savedDeclaredLuminizeSettlement32Schema.parse({
    ...body,
    snapshotFingerprint: contentHash(body),
  })
}

export function isSavedDeclaredLuminizeSettlement32Current(raw: unknown) {
  const snapshot = savedDeclaredLuminizeSettlement32Schema.safeParse(raw)
  if (!snapshot.success) return false
  const declaration = snapshot.data.declaration as DeclaredLuminizeSettlement32
  return (
    declaration.sourceIdentityHash === reviewedLumifluxMechanicsHash32 &&
    evaluateReviewedLuminizeSettlement32(declaration).status === 'declared_arithmetic'
  )
}
