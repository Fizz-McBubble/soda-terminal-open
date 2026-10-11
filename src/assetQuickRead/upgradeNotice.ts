import { assetQuickReadRelease } from './distribution'
import { compareToolVersion } from '../scanner/toolUpgradeNotice'

export function assetQuickReadUpgradeNotice(
  connectedVersion: string | null | undefined,
  targetVersion = assetQuickReadRelease.version,
) {
  return compareToolVersion(connectedVersion, targetVersion) === -1
    ? '资产快读有新版本，请更新资产快读。'
    : null
}
