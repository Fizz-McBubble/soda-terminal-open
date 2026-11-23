import type { Plugin } from 'vite'

export interface CommunityConsumerPolicySourceHashesOptions {
  readSource?: (filename: string) => string
}

export interface CurrentPlanningConsumerPolicyIdentity {
  contract: 'installed-prepared-and-functional-consumer-policy/v1'
  sourceHashes: Record<string, string>
}

export function stableContentHash(input: unknown): string

export function currentPlanningConsumerPolicySourceIdentity(options?: {
  root?: string
  readSource?: (filename: string) => string
}): {
  identity: CurrentPlanningConsumerPolicyIdentity
  sourceFiles: readonly string[]
}

export function currentPlanningConsumerPolicyGeneratedPath(root?: string): string

export function assertCurrentPlanningConsumerPolicyIdentity(options?: {
  root?: string
  readSource?: (filename: string) => string
}): CurrentPlanningConsumerPolicyIdentity

export function writeCurrentPlanningConsumerPolicyIdentity(options?: {
  root?: string
  writeSource?: (filename: string, source: string) => void
}): CurrentPlanningConsumerPolicyIdentity

export function communityConsumerPolicySourceHashes(
  options?: CommunityConsumerPolicySourceHashesOptions,
): Plugin
