import { createContext } from 'react'

export interface PreparationStatus {
  text: string
  pending: boolean
}

/** Installer feedback replaces the current preparation status instead of adding a row. */
export const ScannerPreparationStatus = createContext<((status: PreparationStatus) => void) | null>(
  null,
)
