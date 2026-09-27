import { createContext, useContext } from 'react'

export type F5AccountSummary = {
  hydrating: boolean
  appSessionId: string
  accountId: string | null
  name: string
  agentCount: number
  discCount: number
  hasAccount: boolean
}

const F5AccountSummaryContext = createContext<F5AccountSummary | null>(null)

export const F5AccountSummaryProvider = F5AccountSummaryContext.Provider

export function useF5AccountSummary() {
  return useContext(F5AccountSummaryContext)
}
