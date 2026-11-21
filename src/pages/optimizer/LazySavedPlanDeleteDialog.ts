import { lazy } from 'react'

export const LazySavedPlanDeleteDialog = lazy(() =>
  import('./SavedPlanDeleteDialog').then((module) => ({ default: module.SavedPlanDeleteDialog })),
)
