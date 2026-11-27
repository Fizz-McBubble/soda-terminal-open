import { expect, it } from 'vitest'
import {
  prepareAssetSnapshotExport,
  assetCompatibilityMessage,
  matchesUnverifiedPendingAssetSnapshot,
  restorePendingSnapshotByOriginalDigest,
} from './snapshotRecovery'
import { sha256 } from '../application/contentHash'
import {
  syntheticAssetSnapshot,
  syntheticAssetSnapshot33,
} from './syntheticAssetSnapshotTestFixture'
import { assetSnapshotSchema } from './snapshotProtocolSchema'
import { convertAssetSnapshot } from './snapshotAdapter'

it.each(['legacy_observation_unverified', 'incomplete_observation'])(
  'verifies %s against the original clean 3.3 capture only',
  (code) => {
    const original = syntheticAssetSnapshot33()
    const saved = {
      ...original,
      issues: [{ asset: 'snapshot', field: '', code }],
    }
    expect(matchesUnverifiedPendingAssetSnapshot(saved, original)).toBe(true)
    expect(matchesUnverifiedPendingAssetSnapshot(saved, saved)).toBe(false)
    expect(
      matchesUnverifiedPendingAssetSnapshot(saved, {
        ...original,
        source: {
          ...original.source,
          capture_started_unix_seconds: original.source.capture_started_unix_seconds + 1,
        },
      }),
    ).toBe(false)
    expect(
      matchesUnverifiedPendingAssetSnapshot(
        {
          ...saved,
          issues: [{ asset: 'disc', field: 'uid', code: 'wrong_wire_type' }],
        },
        original,
      ),
    ).toBe(false)
  },
)

it('exports a supported 3.3 candidate without mislabelling it pending adaptation', () => {
  const result = prepareAssetSnapshotExport(syntheticAssetSnapshot33())!
  expect(result.pendingUpdate).toBe(false)
  expect(result.snapshot.source.protocol_version).toBe('3.3')
  expect(convertAssetSnapshot(result.snapshot, { snapshotSha256: 'a'.repeat(64) }).importable).toBe(
    true,
  )
})

it('can prove a clean saved result without picking its file again', () => {
  const original = assetSnapshotSchema.parse(syntheticAssetSnapshot33())
  const saved = {
    ...original,
    issues: [{ code: 'incomplete_observation', asset: 'snapshot', field: '' }],
  }
  for (const indent of [0, 2]) {
    const digest = sha256(JSON.stringify(original, null, indent))
    expect(restorePendingSnapshotByOriginalDigest(saved, digest)).toEqual(original)
  }
  const incompleteDigest = sha256(JSON.stringify(saved, null, 2))
  expect(restorePendingSnapshotByOriginalDigest(saved, incompleteDigest)).toBe(saved)
  const wrongVersion = { ...saved, source: { ...saved.source, protocol_version: '0.0' } }
  expect(
    restorePendingSnapshotByOriginalDigest(wrongVersion, sha256(JSON.stringify(original))),
  ).toBe(wrongVersion)
})

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
  expect(assetCompatibilityMessage('client_dispatch_version_rejected')).toContain('配置版本')
  expect(assetCompatibilityMessage('client_dispatch_seed_shape_rejected')).toContain('参数格式')
  expect(assetCompatibilityMessage('client_dispatch_version_and_seed_shape_rejected')).toContain(
    '均未通过',
  )
})

it.each(['disc', 'engine', 'agent', 'unknown'])(
  'preserves the %s restriction after a sanitized export and reimport',
  (asset) => {
    const input = syntheticAssetSnapshot33()
    input.issues = [{ code: 'private-code', field: 'private-field', asset }]
    const context = { snapshotSha256: 'a'.repeat(64) }
    const original = convertAssetSnapshot(input, context)
    const recovered = prepareAssetSnapshotExport(input)!.snapshot
    expect(JSON.stringify(recovered)).not.toContain('private-')
    expect(convertAssetSnapshot(recovered, context)).toEqual(original)
    expect(prepareAssetSnapshotExport(recovered)!.snapshot).toEqual(recovered)
  },
)
