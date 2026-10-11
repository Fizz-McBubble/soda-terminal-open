import { scannerDistributionManifest } from './distribution'

export function compareToolVersion(installed: string | null | undefined, target: string) {
  if (!installed) return null
  if (installed === target) return 0
  const normalize = (value: string) =>
    value.startsWith('soda-scanner-zzz-next-ppocrv6-') ? value.replace(/-local-\d{8}$/u, '') : value
  installed = normalize(installed)
  target = normalize(target)
  if (installed === target) return 0
  const parts = (value: string) => value.match(/\d+/gu)?.map(Number)
  const a = parts(installed)
  const b = parts(target)
  if (!a || !b || installed.replace(/\d+/gu, '#') !== target.replace(/\d+/gu, '#')) return null
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference) return Math.sign(difference)
  }
  return null
}

export type ScannerToolVersions = {
  installer?: string | null
  helper?: string | null
  runtime?: string | null
  scanner?: string | null
}
export const scannerToolReleaseVersions = {
  installer: scannerDistributionManifest.helper.installerVersion,
  helper: scannerDistributionManifest.helper.version,
  runtime: scannerDistributionManifest.runtime.version,
  scanner: scannerDistributionManifest.runtime.nativeCapture.componentVersion,
}

/** Only connected, observed component versions belong here; missing is not old. */
export function scannerToolUpgradeNotice(
  installed: ScannerToolVersions,
  target: ScannerToolVersions = scannerToolReleaseVersions,
) {
  const labels = {
    installer: '画面扫描',
    helper: '扫描助手',
    scanner: '扫描核心',
    runtime: '扫描组件',
  }
  const outdated = (Object.keys(labels) as (keyof typeof labels)[]).filter(
    (key) => target[key] && compareToolVersion(installed[key], target[key]!) === -1,
  )
  return outdated.length
    ? target.installer
      ? `画面扫描有新版本（v${target.installer}），请更新。`
      : `${outdated.map((key) => labels[key]).join('、')}有新版本，请更新画面扫描。`
    : null
}
