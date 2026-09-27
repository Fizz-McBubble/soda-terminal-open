import { fileURLToPath } from 'node:url'
import boundaries from './public-boundaries.json'

/**
 * Every browser-graph boundary is bound at build time through one specifier, exactly like the visual
 * asset manifest: the desktop build resolves the local implementation, the public build the published
 * projection. Nothing branches at runtime, so the unselected module never enters the built graph —
 * which is what keeps private core, ledgers and desktop-only workspaces out of the public bundle.
 *
 * The private Node artifact always binds the local implementations, so a stray
 * `VITE_SODA_PUBLIC_BUILD` in the environment can never ship a display projection to the API.
 */
export type PublicBoundaryBinding = 'internal' | 'public'

export type PublicBoundary = {
  specifier: string
  local: string
  public: string
}

export const publicBoundaries: readonly PublicBoundary[] = boundaries.boundaries.map(
  ({ specifier, local, public: publicPath }) => ({
    specifier,
    local: fileURLToPath(new URL(local, import.meta.url)),
    public: fileURLToPath(new URL(publicPath, import.meta.url)),
  }),
)

export function publicBoundaryAliases(binding: PublicBoundaryBinding) {
  return publicBoundaries.map(({ specifier, local, public: publicModule }) => ({
    find: specifier,
    replacement: binding === 'public' ? publicModule : local,
  }))
}

export const visualAssetManifestSpecifier = '@soda/visual-asset-manifest'

/** Kept for the existing visual-asset entry points; identical to the boundary binding. */
export function visualAssetManifestAlias(binding: PublicBoundaryBinding) {
  return publicBoundaryAliases(binding).filter(
    (alias) => alias.find === visualAssetManifestSpecifier,
  )
}

export function publicBoundaryModule(specifier: string): string | null {
  const found = publicBoundaries.find((item) => item.specifier === specifier)
  return found ? found.public : null
}
