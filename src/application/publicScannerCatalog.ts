import type { DriveDiscImportSetIdentity } from '../domain/discImport'
import { publicDriveDiscData } from './publicDataProjection'

/** Import identities only. Candidate sets do not carry combat effects into the browser. */
const candidateScanSetIdentities: DriveDiscImportSetIdentity[] = [
  { id: 'set-34100', name: '谶羽之誓', aliases: ['谶羽之誓'], effectStatus: 'candidate' },
  {
    id: 'set-34200',
    name: '棘刺玫瑰',
    aliases: ['棘刺玫瑰', '荆棘玫瑰', 'Thorned Rose', 'ThornedRose'],
    effectStatus: 'candidate',
  },
]

export const publicScannerDriveDiscData = publicDriveDiscData

export const publicScannerSetIdentities: DriveDiscImportSetIdentity[] = [
  ...(publicDriveDiscData?.driveDiscSets ?? []),
  ...candidateScanSetIdentities,
]
