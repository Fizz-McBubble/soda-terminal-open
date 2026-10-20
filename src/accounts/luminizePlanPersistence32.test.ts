import { describe, expect, it } from 'vitest'
import { accountBackupSchema } from './backupSchemas'
import { contentHash } from '../application/contentHash'
import { historicalLuminizeSettlementSchema32 } from '../calculation/luminizeSettlementContract32'
import { luminizeSettlementPlanPersistenceFixture } from './luminizePlanPersistence32.testFixture'
import {
  createSavedDeclaredLuminizeSettlement32,
  isSavedDeclaredLuminizeSettlement32Current,
  savedDeclaredLuminizeSettlement32Contract,
  savedDeclaredLuminizeSettlement32Schema,
} from './luminizePlanPersistence32'
import { reviewedLumifluxMechanicsHash32 } from '../calculation/reviewedLumifluxMechanics32'

describe('saved declared Luminize settlement32', () => {
  it('seals only an evaluable current declaration and accepts the same JSON after restore', () => {
    const saved = createSavedDeclaredLuminizeSettlement32(
      luminizeSettlementPlanPersistenceFixture(),
    )
    expect(saved.contract).toBe(savedDeclaredLuminizeSettlement32Contract)
    expect(saved.declaration.sourceIdentityHash).toBe(reviewedLumifluxMechanicsHash32)
    expect(
      savedDeclaredLuminizeSettlement32Schema.parse(JSON.parse(JSON.stringify(saved))),
    ).toEqual(saved)
    expect(isSavedDeclaredLuminizeSettlement32Current(saved)).toBe(true)
  })

  it('preserves a historical source pin in backup data while rejecting it for current replay', () => {
    const current = createSavedDeclaredLuminizeSettlement32(
      luminizeSettlementPlanPersistenceFixture(),
    )
    const oldDeclaration = historicalLuminizeSettlementSchema32.parse({
      ...current.declaration,
      sourceIdentityHash: 'older-reviewed-source',
    })
    const body = {
      contract: savedDeclaredLuminizeSettlement32Contract,
      declaration: oldDeclaration,
    }
    const historical = {
      ...body,
      snapshotFingerprint: contentHash(body),
    }
    expect(savedDeclaredLuminizeSettlement32Schema.safeParse(historical).success).toBe(true)
    expect(isSavedDeclaredLuminizeSettlement32Current(historical)).toBe(false)
    expect(
      accountBackupSchema.shape.data.shape.planningDrafts
        .removeDefault()
        .element.shape.solutionContext?.unwrap()
        .shape.declaredLuminizeSettlement32.safeParse(historical).success,
    ).toBe(true)
  })

  it('rejects an edited declaration even when its old snapshot seal is retained', () => {
    const saved = createSavedDeclaredLuminizeSettlement32(
      luminizeSettlementPlanPersistenceFixture(),
    )
    const edited = structuredClone(saved)
    edited.declaration.remielle.anomalyProficiency = 0
    expect(savedDeclaredLuminizeSettlement32Schema.safeParse(edited).success).toBe(false)
  })
})
