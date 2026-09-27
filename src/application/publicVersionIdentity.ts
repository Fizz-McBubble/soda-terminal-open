/** The public browser's compiled package identity. Keep this in sync with the private worker. */
export const publicVersionIdentity = {
  id: 'current-version-projection-3.1',
  packageId: 'game-base-3.1.0-current',
  packageVersion: '3.1.0-current.1',
  gameVersion: '3.1',
  contentHash: 'fnv1a-3c577f6c',
  rollbackPackageId: 'game-base-3.0.1',
  lifecycle: 'current',
  fieldBoundary:
    '3.1 是当前读取版本；字段 formal/candidate/missing 独立决定结论强度，current 不等于全部字段 formal。',
} as const
