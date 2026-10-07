export type ScannerDistributionState =
  | 'not_installed'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'ready'
  | 'repair_required'
  | 'update_available'
  | 'blocked'

export type ScannerDistributionSnapshot = {
  state: ScannerDistributionState
  installedVersion: string | null
  targetVersion: string
  progressPercent: number | null
  action: 'download' | 'continue' | 'repair' | 'update' | 'open' | 'none'
  message: string
}

export const scannerDistributionManifest = {
  schemaVersion: 1,
  installationRoot: '%LOCALAPPDATA%\\SodaTerminal\\Scanner',
  connection: 'bundled-loopback-helper',
  helper: {
    version: installerReleaseManifest.helperVersion,
    installerVersion: installerReleaseManifest.version,
    upstreamCommit: '051642b677315c23f4c3e838d0093ec2ea849ca9',
    license: 'MIT; bundled runtime licenses retained',
    downloadUrl: '/downloads/Soda-Scanner-Setup.exe',
    size: installerReleaseManifest.size,
    sha256: installerReleaseManifest.sha256,
    entry: installerReleaseManifest.assetName,
  },
  runtime: {
    version: runtimeReleaseManifest.runtimeVersion,
    license: 'MIT + Apache-2.0',
    entry: 'scanner-runtime.json',
    defaultOcr: 'PP-OCRv6-small-ONNX',
    releaseState:
      runtimeReleaseManifest.releaseState === 'published' ? 'published' : 'not_published',
    releaseTag: runtimeReleaseManifest.releaseTag,
    packageUrl: runtimeReleaseManifest.assetUrl,
    packageSize: runtimeReleaseManifest.size,
    packageSha256: runtimeReleaseManifest.sha256,
    installedSize: 324_733_812,
    packaging:
      'self-contained ZZZ-Scanner.Next 1.0.49 Soda fork + direct PP-OCRv6/R4 + bundled Helper',
    orchestration: {
      entry: 'native/ZZZ-Scanner.Next.Soda.exe',
      entrySha256: '6defec2f1149d27007d8453c79acd37da3d154a0e3c6058a9fc0fe9588c5841f',
      geometrySchema: 'soda.scanner.detail-geometry.v1',
      geometrySha256: '2a20163ae13d47d6f53f6fd8ced26ca2c76c90764e803fd9e64c8732e385dd67',
      catalogSha256: 'bc12a3531ab338e4cff086ddfc547b1a212b792bc829c4036f567a703349c088',
    },
    excludedRuntimeFamilies: [
      'paddlepaddle',
      'paddleocr',
      'paddlex',
      'opencv',
      'pandas',
      'python',
      'pip',
      'venv',
      'PP-OCRv5',
    ],
    nativeCapture: {
      componentVersion: 'ZZZ-Scanner.Next-1.0.49-soda-r22',
      upstreamCommit: 'ff90891140016d3f1b738d73cb6cd9b291e17cec',
      schemaVersion: 'soda.zzz-scanner-next.direct-r4.v1',
      entry: 'native/ZZZ-Scanner.Next.Soda.exe',
      entrySize: 184_512_035,
      entrySha256: '6defec2f1149d27007d8453c79acd37da3d154a0e3c6058a9fc0fe9588c5841f',
      selfContained: true,
      singleFile: true,
      publishAot: false,
    },
    nativeOcr: {
      entry: 'ocr/Soda.ScannerPpOcrV6.exe',
      entrySize: 35_660_734,
      entrySha256: '8f11e9d67b0d28c494ed45d7b3d125f49705f39b0cd9be6468902b4dd8f7a32e',
      runtime: 'onnxruntime-1.23.1',
      selfContained: true,
      singleFile: true,
      publishAot: false,
    },
  },
  ocr: {
    version: 'PP-OCRv6-small-rec-onnx-2026-07-31',
    license: 'Apache-2.0',
    activatedByDefault: true,
    benchmarkEvidence: 'r8-fixed-30-native-onnx-benchmark',
    models: [
      {
        id: 'PP-OCRv6_small_rec_onnx',
        revision: 'main@2026-07-31',
        files: [
          {
            file: 'inference.onnx',
            size: 21_159_378,
            sha256: '5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634',
          },
          {
            file: 'inference.yml',
            size: 150_579,
            sha256: 'ab078671bb49f06228eadccd34f1bb501e157f7a047095ffb943ba81512c77d1',
          },
        ],
      },
    ],
  },
} as const

export const initialDistributionSnapshot: ScannerDistributionSnapshot = {
  state: 'not_installed',
  installedVersion: null,
  targetVersion: scannerDistributionManifest.runtime.version,
  progressPercent: null,
  action: 'none',
  message: '扫描组件发布包尚未就绪，暂时不能下载。',
}

export function scannerDistributionActionLabel(snapshot: ScannerDistributionSnapshot) {
  switch (snapshot.action) {
    case 'download':
      return '下载扫描组件'
    case 'continue':
      return '继续下载'
    case 'repair':
      return '修复组件'
    case 'update':
      return '更新组件'
    case 'open':
      return '打开助手'
    default:
      return '当前不可用'
  }
}

export function resolveDistributionSnapshot(input: {
  installedVersion?: string | null
  downloadProgress?: number | null
  phase?: 'idle' | 'downloading' | 'verifying' | 'installing'
  integrity?: 'valid' | 'invalid' | 'unknown'
  blockedReason?: string | null
  releaseState?: 'not_published' | 'published'
}): ScannerDistributionSnapshot {
  const targetVersion = scannerDistributionManifest.runtime.version
  const releaseState = input.releaseState ?? scannerDistributionManifest.runtime.releaseState
  if (input.blockedReason)
    return {
      state: 'blocked',
      installedVersion: input.installedVersion ?? null,
      targetVersion,
      progressPercent: null,
      action: 'none',
      message: input.blockedReason,
    }
  if (input.phase && input.phase !== 'idle')
    return {
      state: input.phase,
      installedVersion: input.installedVersion ?? null,
      targetVersion,
      progressPercent: input.downloadProgress ?? null,
      action: input.phase === 'downloading' ? 'continue' : 'none',
      message:
        input.phase === 'downloading'
          ? '正在下载本机组件，可中断后继续。'
          : input.phase === 'verifying'
            ? '正在校验文件身份。'
            : '正在原子安装组件。',
    }
  if (input.installedVersion && input.integrity === 'invalid')
    return {
      state: 'repair_required',
      installedVersion: input.installedVersion,
      targetVersion,
      progressPercent: null,
      action: 'repair',
      message: '组件文件不完整，可从上一可用版本安全修复。',
    }
  if (input.installedVersion && input.installedVersion !== targetVersion)
    return {
      state: 'update_available',
      installedVersion: input.installedVersion,
      targetVersion,
      progressPercent: null,
      action: 'update',
      message: '有可校验的新版本；更新失败会保留当前版本。',
    }
  if (input.installedVersion && input.integrity === 'valid')
    return {
      state: 'ready',
      installedVersion: input.installedVersion,
      targetVersion,
      progressPercent: null,
      action: 'open',
      message: '扫描组件已校验，可由网页直接打开。',
    }
  if (releaseState === 'published')
    return {
      ...initialDistributionSnapshot,
      action: 'download',
      message: '扫描组件已发布，可下载后校验并安装。',
    }
  return initialDistributionSnapshot
}
import runtimeReleaseManifest from '../../public/downloads/scanner-runtime-release.v1.json'
import installerReleaseManifest from '../../public/downloads/scanner-installer-release.v1.json'
