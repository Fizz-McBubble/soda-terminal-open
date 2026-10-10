import type { Connect } from 'vite'

export type InstallerMaterialization = {
  state: 'not_published' | 'verified' | 'materialized'
  path?: string
  size?: number
  sha256?: string
}
export function materializeAssetQuickReadInstaller(options?: {
  manifest?: Record<string, unknown>
  output?: string
  stagingDirectory?: string
  sourcePath?: string
  fetchImpl?: typeof fetch
}): Promise<InstallerMaterialization>
export function assetQuickReadInstallerMiddleware(
  options?: Parameters<typeof materializeAssetQuickReadInstaller>[0],
): Connect.NextHandleFunction
