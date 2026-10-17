import { describe, expect, it } from 'vitest'

import {
  assetQuickReadDownloadAvailable,
  assetQuickReadRelease,
} from '../assetQuickRead/distribution'
import assetQuickReadManifest from '../assetQuickRead/releaseManifest.json'
import { assetQuickReadUpgradeNotice } from '../assetQuickRead/upgradeNotice'
import scannerInstallerManifest from '../../public/downloads/scanner-installer-release.v1.json'
import scannerRuntimeManifest from '../../public/downloads/scanner-runtime-release.v1.json'
import { scannerDistributionManifest } from './distribution'
import scanFeedbackContract from './scanFeedback.contract.json'
import { scannerInstallerFileName } from './installerDownload'
import {
  compareToolVersion,
  scannerToolReleaseVersions,
  scannerToolUpgradeNotice,
} from './toolUpgradeNotice'

describe('versionConsistencyAudit (real consumer imports)', () => {
  it('validates asset quick-read distribution and download availability with real consumers', () => {
    // New product releases carry after 9; historical compatibility identities stay unchanged.
    for (const version of [assetQuickReadManifest.version, scannerInstallerManifest.version]) {
      expect(version).toMatch(/^(?:0|[1-9]\d*)\.[0-9]\.[0-9]$/u)
    }
    // Verified against real assetQuickReadRelease object and distribution consumer
    expect(assetQuickReadDownloadAvailable(assetQuickReadRelease)).toBe(true)
    expect(assetQuickReadRelease).toEqual(assetQuickReadManifest)
    expect(assetQuickReadRelease.fileName).toBe(
      `SodaTerminal-AssetReader-Setup-${assetQuickReadManifest.version}.exe`,
    )
    expect(assetQuickReadRelease.downloadUrl).toBe('/downloads/Soda-Asset-Quick-Read-Setup.exe')
    expect(assetQuickReadRelease.size).toBeGreaterThanOrEqual(2)
    expect(assetQuickReadRelease.sha256).toMatch(/^[a-fA-F0-9]{64}$/)

    // Rejection on tampered metadata
    expect(
      assetQuickReadDownloadAvailable({
        ...assetQuickReadRelease,
        fileName: 'WrongName.exe',
      }),
    ).toBe(false)
    expect(
      assetQuickReadDownloadAvailable({
        ...assetQuickReadRelease,
        size: 0,
      }),
    ).toBe(false)
    expect(
      assetQuickReadDownloadAvailable({
        ...assetQuickReadRelease,
        sha256: 'not-a-valid-sha256',
      }),
    ).toBe(false)
  })

  it('verifies scanner installer naming logic with real production consumer', () => {
    // Verified with real scannerInstallerFileName function
    expect(scannerInstallerFileName(scannerInstallerManifest.version)).toBe(
      `SodaTerminal-Scanner-Setup-${scannerInstallerManifest.version}.exe`,
    )
    expect(scannerInstallerFileName('1.0.8')).toBe('Soda-画面扫描-1.0.8.exe')
    expect(scannerInstallerFileName('1.0.9')).toBe('SodaTerminal-Scanner-Setup-1.0.9.exe')
    expect(() => scannerInstallerFileName('invalid')).toThrow('invalid_installer_version')
  })

  it('evaluates upgrade notices using real upgrade notice functions and release versions', () => {
    // Asset Quick Read upgrade notice compares the connected Bridge with the pinned target.
    expect(assetQuickReadUpgradeNotice('1.0.4')).toBe('资产快读有新版本，请更新资产快读。')
    expect(assetQuickReadUpgradeNotice('1.0.5')).toBe('资产快读有新版本，请更新资产快读。')
    expect(assetQuickReadUpgradeNotice('1.0.6')).toBe('资产快读有新版本，请更新资产快读。')
    expect(assetQuickReadUpgradeNotice('1.0.7')).toBe('资产快读有新版本，请更新资产快读。')
    expect(assetQuickReadUpgradeNotice(assetQuickReadManifest.bridgeVersion)).toBeNull()
    expect(assetQuickReadUpgradeNotice(null)).toBeNull()
    expect(assetQuickReadUpgradeNotice('unknown')).toBeNull()

    // Scanner tool upgrade notice using real release versions
    expect(
      scannerToolUpgradeNotice(scannerToolReleaseVersions, scannerToolReleaseVersions),
    ).toBeNull()

    // Outdated helper triggers prompt with installer version
    expect(
      scannerToolUpgradeNotice(
        { ...scannerToolReleaseVersions, helper: '2.3.15' },
        scannerToolReleaseVersions,
      ),
    ).toBe(`画面扫描有新版本（v${scannerInstallerManifest.version}），请更新。`)

    // Outdated scanner capture fork component triggers prompt
    expect(
      scannerToolUpgradeNotice(
        { ...scannerToolReleaseVersions, scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r31' },
        scannerToolReleaseVersions,
      ),
    ).toBe(`画面扫描有新版本（v${scannerInstallerManifest.version}），请更新。`)

    // When installer is omitted, notice lists specific outdated component labels
    expect(
      scannerToolUpgradeNotice(
        { ...scannerToolReleaseVersions, helper: '2.3.15' },
        { ...scannerToolReleaseVersions, installer: null },
      ),
    ).toBe('扫描助手有新版本，请更新画面扫描。')
  })

  it('matches diagnostic feedback contract version patterns against published manifests', () => {
    // Bridge version in manifest matches assetQuickRead bridge pattern
    expect(assetQuickReadManifest.bridgeVersion).toMatch(
      new RegExp(scanFeedbackContract.assetQuickRead.versionPatterns.bridge),
    )

    // Scanner helper version matches helper pattern
    expect(scannerInstallerManifest.helperVersion).toMatch(
      new RegExp(scanFeedbackContract.versionPatterns.helper),
    )

    // Scanner fork component matches scanner pattern
    expect(scannerRuntimeManifest.captureVersion).toMatch(
      new RegExp(scanFeedbackContract.versionPatterns.scanner),
    )

    // Scanner runtime matches runtime pattern
    expect(scannerRuntimeManifest.runtimeVersion).toMatch(
      new RegExp(scanFeedbackContract.versionPatterns.runtime),
    )

    // Scanner OCR matches OCR pattern
    expect(scannerRuntimeManifest.ocrVersion).toMatch(
      new RegExp(scanFeedbackContract.versionPatterns.ocr),
    )

    // Installer version patterns:
    // Asset quick-read installer accepts current 1.0.10 and planned next 1.1.0
    const assetInstallerPattern = new RegExp(
      scanFeedbackContract.assetQuickReadInstaller.versionPattern,
    )
    expect('1.0.8').toMatch(assetInstallerPattern)
    expect('1.0.10').toMatch(assetInstallerPattern)
    expect('1.1.0').toMatch(assetInstallerPattern)
    expect('1.2.0').not.toMatch(assetInstallerPattern)
    expect('2.0.0').not.toMatch(assetInstallerPattern)

    // Screen scanner installer accepts the current decimal release.
    const screenInstallerPattern = new RegExp(
      scanFeedbackContract.screenScannerInstaller.versionPattern,
    )
    expect(scannerInstallerManifest.version).toMatch(screenInstallerPattern)
    expect('1.0.9').not.toMatch(screenInstallerPattern)
  })

  it('enforces semantic anti-conflation of independent tool components', () => {
    // Product and internal service have independent version identities.
    expect(assetQuickReadManifest.version).not.toBe(assetQuickReadManifest.bridgeVersion)
    expect(assetQuickReadManifest.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(assetQuickReadManifest.bridgeVersion).toMatch(/^\d+\.\d+\.\d+$/)

    // Scanner installer vs Helper service vs locked fork identities stay independent.
    expect(scannerInstallerManifest.version).not.toBe(scannerInstallerManifest.helperVersion)
    expect(scannerInstallerManifest.helperVersion).not.toBe('1.0.49')
    expect(scannerRuntimeManifest.captureVersion).toMatch(/1\.0\.49/)
    expect(scannerInstallerManifest.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(scannerInstallerManifest.helperVersion).toBe('2.3.18')
    expect(scannerRuntimeManifest.captureVersion).toBe(
      scannerDistributionManifest.runtime.nativeCapture.componentVersion,
    )

    expect(compareToolVersion(assetQuickReadRelease.version, assetQuickReadManifest.version)).toBe(
      0,
    )
  })
})
