import { describe, expect, it } from 'vitest'
import { bundledGameDataPacks, gameBase31Current } from './baseline'
import { currentVersionAdoption32, gameBase32Current } from './currentVersionAdoption32'
import { currentVersionProjection } from './currentVersionProjection'
import { currentScopeManifest } from './currentScopeManifest'
import { gameData32CatalogEntities, gameData32UpstreamCommit } from './gameData32CatalogEntities'
import { gameData31CurrentCanonical } from './gameData31CurrentCanonical'
import { incremental32RecoveryPolicy } from './incremental32RecoveryPolicy'
import { validateManifest } from './types'

describe('installed 3.2 Phase II read-view adoption', () => {
  it('binds projection to the actual registered package and reviewed source identity', () => {
    expect(validateManifest(gameBase32Current)).toMatchObject({ success: true })
    expect(bundledGameDataPacks.filter((pack) => pack.id === gameBase32Current.id)).toEqual([
      gameBase32Current,
    ])
    expect(currentVersionProjection).toMatchObject({
      gameVersion: '3.2',
      packageId: gameBase32Current.id,
      packageVersion: gameBase32Current.packageVersion,
      phase: 'phase_ii',
      lifecycle: 'current',
      adoptionId: currentVersionAdoption32.id,
      adoptionContentHash: currentVersionAdoption32.contentHash,
      sourceCommit: gameData32UpstreamCommit,
    })
    expect(currentVersionProjection.fieldBoundary).toContain('current 不等于全部字段 formal')
    expect(gameBase32Current.sources).toContainEqual(
      expect.objectContaining({
        label: currentVersionAdoption32.id,
        contentHash: currentVersionAdoption32.contentHash,
      }),
    )
  })

  it('derives adopted catalogue counts and per-entity source hashes rather than relabeling old counts', () => {
    expect(currentVersionProjection.directoryCoverage).toEqual(currentScopeManifest.coverage)
    expect(gameBase32Current.coverage.map((entry) => entry.stableId)).toEqual(
      currentScopeManifest.entries.map((entry) => entry.stableId),
    )
    for (const entity of gameData32CatalogEntities) {
      expect(gameBase32Current.coverage).toContainEqual(
        expect.objectContaining({
          stableId: entity.id,
          sourceVersion: '3.2',
          sourceContentHash: entity.source.contentHash,
          calculationEligibility: 'quality_only',
        }),
      )
      expect(currentVersionAdoption32.sourceIdentity.additions).toContainEqual(
        expect.objectContaining({
          stableId: entity.id,
          upstreamPath: entity.fields.upstreamPath,
          rawSha256: entity.fields.upstreamRawSha256,
        }),
      )
    }
    expect(
      currentVersionAdoption32.sourceIdentity.additions.filter((entry) => entry.domain === 'agent'),
    ).toHaveLength(2)
    expect(
      currentVersionAdoption32.sourceIdentity.additions.filter(
        (entry) => entry.domain === 'wengine',
      ),
    ).toHaveLength(5)
  })

  it('preserves legacy pack and canonical versions without promoting their review strength', () => {
    expect(gameBase31Current).toMatchObject({
      gameVersion: '3.1',
      packageVersion: '3.1.0-current.1',
      rollbackTo: 'game-base-3.0.1',
    })
    expect(gameData31CurrentCanonical.gameVersion).toBe('3.1')
    expect(
      gameBase31Current.coverage.some((entry) => entry.classification === '字段强度：candidate'),
    ).toBe(true)
    expect(gameBase31Current.missing.length).toBeGreaterThan(0)
    expect(currentVersionAdoption32.legacyFieldAuthority).toMatchObject({
      gameVersion: '3.1',
      contentHash: gameData31CurrentCanonical.contentHash,
    })
    expect(
      gameBase32Current.coverage.every((entry) => entry.calculationEligibility === 'quality_only'),
    ).toBe(true)
  })

  it('references actual compatibility recovery instead of manufacturing an activatable recovery data pack', () => {
    expect(gameBase32Current.rollbackTo).toBeNull()
    expect(currentVersionProjection.rollbackPackageId).toBeNull()
    expect(currentVersionAdoption32.compatibilityRecovery).toMatchObject({
      policyId: incremental32RecoveryPolicy.id,
      disabledCapabilityScope: '3.2_precision_only',
      preservesAccountAndSavedPlans: true,
      preservesReleasedIdentities: true,
      capabilityIdentity: incremental32RecoveryPolicy.capabilityIdentity,
    })
    expect(gameBase32Current.migrationNotes.join(' ')).toContain('VITE_SODA_INCREMENTAL32_RECOVERY')
  })
})
