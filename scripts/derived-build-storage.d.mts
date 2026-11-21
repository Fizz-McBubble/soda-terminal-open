export declare function workspaceDerivedRoot(text: string): string | null
export declare function prepareDerivedTemporaryEnvironment(
  task: string,
  appRoot?: string,
  env?: Record<string, string | undefined>,
): Record<string, string | undefined>
export declare function enterDerivedTemporaryEnvironment(task: string): () => void
export declare function resolveBuildStorage(
  appRoot?: string,
  env?: Record<string, string | undefined>,
): {
  derivedRoot: string
  communityDist: string
  source: 'environment' | 'workspace-store' | 'portable'
}
