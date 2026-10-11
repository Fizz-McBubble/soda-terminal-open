import { expect, it } from 'vitest'
import { requireCurrentScannerHelper, verifyScannerHelperIdentity } from './runtimeHelperVersion'
import { compareToolVersion, scannerToolUpgradeNotice } from './toolUpgradeNotice'
import { assetQuickReadUpgradeNotice } from '../assetQuickRead/upgradeNotice'
import {
  assetQuickReadDownloadAvailable,
  assetQuickReadRelease,
} from '../assetQuickRead/distribution'

it('compares observed versions without treating unknown or newer versions as old', () => {
  expect(compareToolVersion('2.3.10', '2.3.11')).toBe(-1)
  expect(compareToolVersion('2.3.11', '2.3.11')).toBe(0)
  expect(compareToolVersion('2.3.12', '2.3.11')).toBe(1)
  expect(compareToolVersion('unknown', '2.3.11')).toBeNull()
  expect(compareToolVersion(null, '2.3.11')).toBeNull()
  expect(
    compareToolVersion(
      'soda-scanner-zzz-next-ppocrv6-18-rc8-8',
      'soda-scanner-zzz-next-ppocrv6-18-rc8-9-local-20261011',
    ),
  ).toBe(-1)
})
it('names only outdated scanner layers against the injected locked release', () => {
  const target = {
    helper: '2.3.11',
    scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r28',
    runtime: 'soda-scanner-zzz-next-ppocrv6-18-rc8-9',
  }
  expect(scannerToolUpgradeNotice({ ...target, helper: '2.3.10' }, target)).toBe(
    '扫描助手有新版本，请更新画面扫描。',
  )
  expect(
    scannerToolUpgradeNotice({ ...target, scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r27' }, target),
  ).toBe('扫描核心有新版本，请更新画面扫描。')
  expect(scannerToolUpgradeNotice(target, target)).toBeNull()
  expect(scannerToolUpgradeNotice({}, target)).toBeNull()
})
it('prompts compatible old asset bridges, but never current or unknown bridges', () => {
  expect(assetQuickReadUpgradeNotice('1.0.0', '1.0.1')).toBe('资产快读有新版本，请更新资产快读。')
  expect(assetQuickReadUpgradeNotice('1.0.1', '1.0.1')).toBeNull()
  expect(assetQuickReadUpgradeNotice('unknown', '1.0.1')).toBeNull()
})
it('accepts both frozen download identities but rejects mismatched or unrecognized identities', () => {
  const candidate = {
    ...assetQuickReadRelease,
    version: '1.0.1',
    fileName: 'SodaTerminal-AssetReader-Setup-1.0.1.exe',
    releaseTag: 'v1.0.1',
  }
  expect(assetQuickReadDownloadAvailable(assetQuickReadRelease)).toBe(true)
  expect(assetQuickReadDownloadAvailable(candidate)).toBe(true)
  expect(
    assetQuickReadDownloadAvailable({ ...candidate, fileName: assetQuickReadRelease.fileName }),
  ).toBe(false)
  expect(assetQuickReadDownloadAvailable({ ...candidate, version: '9.0.0' })).toBe(false)
})
it('connects a newer compatible Helper without asking the player to downgrade', () => {
  const identity = {
    service: 'soda-terminal-scanner-helper',
    version: '2.3.11',
    protocolVersion: 5,
    transport: 'direct-fork-http',
    accountWriteEnabled: false,
    importAccess: false,
  }
  expect(verifyScannerHelperIdentity(identity)).toBe('2.3.11')
  expect(() => requireCurrentScannerHelper('2.3.11')).not.toThrow()
  expect(() => requireCurrentScannerHelper('2.3.9')).toThrow()
  expect(() => requireCurrentScannerHelper('2.4.1')).toThrow()
  expect(() => requireCurrentScannerHelper(null)).toThrow()
  expect(() => verifyScannerHelperIdentity({ ...identity, protocolVersion: 4 })).toThrow()
  expect(() => verifyScannerHelperIdentity({ ...identity, accountWriteEnabled: true })).toThrow()
})
