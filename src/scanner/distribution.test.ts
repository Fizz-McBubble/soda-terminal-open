import { describe, expect, it } from 'vitest'
import {
  initialDistributionSnapshot,
  resolveDistributionSnapshot,
  scannerDistributionManifest,
} from './distribution'

describe('scanner distribution contract', () => {
  it('locks the published RC8.7 dual-origin direct-fork identity and makes v6 the single OCR runtime', () => {
    expect(scannerDistributionManifest.helper.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(scannerDistributionManifest.helper.size).toBeGreaterThan(
      scannerDistributionManifest.runtime.packageSize,
    )
    expect(scannerDistributionManifest.runtime.defaultOcr).toBe('PP-OCRv6-small-ONNX')
    expect(scannerDistributionManifest.runtime.packageSize).toBeLessThan(170 * 1024 * 1024)
    expect(scannerDistributionManifest.runtime.packageSha256).toHaveLength(64)
    expect(scannerDistributionManifest.runtime.releaseState).toBe('published')
    expect(scannerDistributionManifest.runtime.packageUrl).toBe(
      'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.7/soda-scanner-runtime-18-rc8-7-win-x64.zip',
    )
    expect(scannerDistributionManifest.runtime.packageUrl).not.toContain('/latest/')
    expect(scannerDistributionManifest.runtime.excludedRuntimeFamilies).toEqual(
      expect.arrayContaining(['paddlepaddle', 'paddleocr', 'paddlex', 'opencv', 'python', 'venv']),
    )
    expect(scannerDistributionManifest.runtime.nativeCapture).toMatchObject({
      componentVersion: 'ZZZ-Scanner.Next-1.0.49-soda-r26',
      schemaVersion: 'soda.zzz-scanner-next.direct-r4.v1',
      selfContained: true,
      publishAot: false,
    })
    expect(scannerDistributionManifest.runtime.nativeCapture.entrySha256).toHaveLength(64)
    expect(scannerDistributionManifest.runtime.nativeOcr).toMatchObject({
      runtime: 'onnxruntime-1.23.1',
      selfContained: true,
      singleFile: true,
    })
    expect(scannerDistributionManifest.runtime.nativeOcr.entrySha256).toHaveLength(64)
    expect(scannerDistributionManifest.runtime.orchestration).toMatchObject({
      entry: 'native/ZZZ-Scanner.Next.Soda.exe',
      geometrySchema: 'soda.scanner.detail-geometry.v1',
    })
    expect(scannerDistributionManifest.runtime.orchestration.geometrySha256).toHaveLength(64)
    expect(scannerDistributionManifest.ocr.activatedByDefault).toBe(true)
    expect(scannerDistributionManifest.ocr.models).toHaveLength(1)
    expect(
      scannerDistributionManifest.ocr.models.every((model) =>
        model.files.every((file) => file.sha256.length === 64),
      ),
    ).toBe(true)
  })

  it('offers the published runtime while refusing download when an unpublished state is injected', () => {
    expect(initialDistributionSnapshot).toMatchObject({ state: 'not_installed', action: 'none' })
    expect(resolveDistributionSnapshot({})).toMatchObject({
      state: 'not_installed',
      action: 'download',
    })
    expect(resolveDistributionSnapshot({ releaseState: 'not_published' })).toMatchObject({
      state: 'not_installed',
      action: 'none',
    })
    expect(
      resolveDistributionSnapshot({ phase: 'downloading', downloadProgress: 42 }),
    ).toMatchObject({ state: 'downloading', action: 'continue', progressPercent: 42 })
    expect(resolveDistributionSnapshot({ phase: 'verifying' }).state).toBe('verifying')
    expect(resolveDistributionSnapshot({ phase: 'installing' }).state).toBe('installing')
    expect(
      resolveDistributionSnapshot({
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc6',
        integrity: 'invalid',
      }),
    ).toMatchObject({ state: 'repair_required', action: 'repair' })
    expect(
      resolveDistributionSnapshot({
        installedVersion: 'soda-scanner-native-ppocrv6-1',
        integrity: 'valid',
      }),
    ).toMatchObject({ state: 'update_available', action: 'update' })
    expect(
      resolveDistributionSnapshot({
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-17',
        integrity: 'valid',
      }),
    ).toMatchObject({ state: 'update_available', action: 'update' })
    expect(
      resolveDistributionSnapshot({
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc6',
        integrity: 'valid',
      }),
    ).toMatchObject({ state: 'update_available', action: 'update' })
    expect(
      resolveDistributionSnapshot({
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc8-1',
        integrity: 'valid',
      }),
    ).toMatchObject({ state: 'update_available', action: 'update' })
    expect(
      resolveDistributionSnapshot({
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc8-5',
        integrity: 'valid',
      }),
    ).toMatchObject({ state: 'update_available', action: 'update' })
    expect(
      resolveDistributionSnapshot({
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc8-6',
        integrity: 'valid',
      }),
    ).toMatchObject({ state: 'update_available', action: 'update' })
    expect(
      resolveDistributionSnapshot({
        installedVersion: scannerDistributionManifest.runtime.version,
        integrity: 'valid',
      }),
    ).toMatchObject({ state: 'ready', action: 'open' })
    expect(
      resolveDistributionSnapshot({ blockedReason: '未知服务占用了助手端口。' }),
    ).toMatchObject({ state: 'blocked', action: 'none' })
    expect(resolveDistributionSnapshot({ releaseState: 'published' })).toMatchObject({
      state: 'not_installed',
      action: 'download',
    })
  })

  it('downloads the complete native installer for the strict loopback helper', () => {
    expect(scannerDistributionManifest.helper.downloadUrl).toBe('/downloads/Soda-Scanner-Setup.exe')
    expect(scannerDistributionManifest.connection).toBe('bundled-loopback-helper')
  })
})
