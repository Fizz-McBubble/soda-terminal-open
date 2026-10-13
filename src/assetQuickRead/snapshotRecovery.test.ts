import { expect, it } from 'vitest'
import { prepareAssetSnapshotExport, assetCompatibilityMessage } from './snapshotRecovery'
import { syntheticAssetSnapshot } from './syntheticAssetSnapshotTestFixture'
import { assetSnapshotSchema } from './snapshotProtocolSchema'
import { convertAssetSnapshot } from './snapshotAdapter'

it('exports current and pending snapshots through the whitelist without relaxing import', () => {
  const input = syntheticAssetSnapshot()
  expect(assetSnapshotSchema.safeParse(prepareAssetSnapshotExport(input)?.snapshot).success).toBe(
    true,
  )
  input.source.protocol_version = '3.3'
  input.source.upstream_commit = 'b'.repeat(40)
  Object.assign(input, {
    accountId: 'secret',
    raw_traffic: 'secret',
    credentials: 'secret',
    logs: ['secret'],
  })
  Object.assign(input.source, { token: 'secret', handshake: 'secret', uid: 'secret' })
  Object.assign(input.assets.agents[0], { accountUid: 'secret' })
  Object.assign(input.assets.discs[0].uid, { token: 'secret' })
  input.issues = [{ code: 'secret', asset: 'secret', field: 'secret' }]
  const result = prepareAssetSnapshotExport(input)!
  expect(result.pendingUpdate).toBe(true)
  expect(result.snapshot).toMatchObject({
    ready_for_account_import: false,
    recovery_status: 'pending_adaptation',
  })
  expect(JSON.stringify(result.snapshot)).not.toContain('secret')
  expect(result.snapshot.assets).toEqual(syntheticAssetSnapshot().assets)
  expect(assetSnapshotSchema.safeParse(result.snapshot).success).toBe(false)
  expect(convertAssetSnapshot(result.snapshot, { snapshotSha256: 'a'.repeat(64) }).importable).toBe(
    false,
  )
})

it('does not advertise recovery for unsafe identities or malformed asset structures', () => {
  for (const change of [
    (input: ReturnType<typeof syntheticAssetSnapshot>) => {
      input.source.upstream_commit = 'secret'
    },
    (input: ReturnType<typeof syntheticAssetSnapshot>) => {
      input.source.protocol_version = '3.3 secret'
    },
    (input: ReturnType<typeof syntheticAssetSnapshot>) => {
      input.assets.discs[0].uid.value = -1
    },
    (input: ReturnType<typeof syntheticAssetSnapshot>) => {
      input.coverage.disc_load_received = false
    },
  ]) {
    const input = syntheticAssetSnapshot()
    input.source.protocol_version = '3.3'
    change(input)
    expect(prepareAssetSnapshotExport(input)).toBeNull()
  }
  expect(prepareAssetSnapshotExport(null)).toBeNull()
  expect(prepareAssetSnapshotExport([])).toBeNull()
})

it('keeps the unknown S-disc whole-candidate blocker when export is available', () => {
  const input = syntheticAssetSnapshot()
  input.assets.discs[0].catalog_id.value = 9999941
  expect(prepareAssetSnapshotExport(input)?.pendingUpdate).toBe(false)
  expect(convertAssetSnapshot(input, { snapshotSha256: 'a'.repeat(64) })).toMatchObject({
    importable: false,
  })
})

it('explains client compatibility without echoing untrusted failure text', () => {
  expect(assetCompatibilityMessage('client_dispatch_version_or_seed_shape_rejected')).toContain(
    '等待资产快读适配更新',
  )
  expect(assetCompatibilityMessage('secret')).toBeNull()
})
