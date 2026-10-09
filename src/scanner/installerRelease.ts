import { scannerInstallerFileName, waitForAbortable } from './installerDownload'

export const installerReleaseUrl = '/downloads/scanner-installer-release.v1.json'
const maximumInstallerSize = 1024 * 1024 * 1024

export type InstallerRelease = {
  version: string
  helperVersion: string
  fileName: string
  downloadUrl: string
  size: number
  sha256: string
}

/** Accept only the published installer identity from the existing release schema. */
export function parseInstallerRelease(value: unknown): InstallerRelease {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_installer_release')
  const release = value as Record<string, unknown>
  const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u
  if (
    release.schemaVersion !== 1 ||
    release.releaseState !== 'published' ||
    typeof release.version !== 'string' ||
    !versionPattern.test(release.version) ||
    typeof release.helperVersion !== 'string' ||
    !versionPattern.test(release.helperVersion) ||
    release.releaseTag !== `scanner-installer-v${release.version}` ||
    release.assetName !== 'Soda-Scanner-Setup.exe' ||
    release.assetUrl !==
      `https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-installer-v${release.version}/Soda-Scanner-Setup.exe` ||
    typeof release.size !== 'number' ||
    !Number.isSafeInteger(release.size) ||
    release.size < 2 ||
    release.size > maximumInstallerSize ||
    typeof release.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(release.sha256)
  )
    throw new Error('invalid_installer_release')
  return {
    version: release.version,
    helperVersion: release.helperVersion,
    fileName: scannerInstallerFileName(release.version),
    downloadUrl: `/downloads/${release.assetName}`,
    size: release.size,
    sha256: release.sha256,
  }
}

export async function readInstallerRelease(signal: AbortSignal): Promise<InstallerRelease> {
  signal.throwIfAborted()
  const responsePromise = fetch(installerReleaseUrl, {
    credentials: 'omit',
    cache: 'no-store',
    mode: 'same-origin',
    redirect: 'error',
    signal,
  })
  void responsePromise.then(
    (response) => {
      if (signal.aborted) void response.body?.cancel().catch(() => {})
    },
    () => {},
  )
  const response = await waitForAbortable(responsePromise, signal)
  signal.throwIfAborted()
  if (!response.ok || response.redirected) throw new Error('installer_release_unavailable')
  const value: unknown = await waitForAbortable(response.json(), signal)
  signal.throwIfAborted()
  return parseInstallerRelease(value)
}
