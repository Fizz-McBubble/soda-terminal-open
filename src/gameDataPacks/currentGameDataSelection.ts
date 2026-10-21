/** Installed package selector. Keep this dependency-free: low-level catalogue
 * consumers must not import the canonical calculation graph to read a version.
 * The full currentVersionProjection verifies this selection against its package. */
export const currentGameDataSelection: Readonly<{
  gameVersion: string
  packageId: string
  phase: 'phase_i' | 'phase_ii'
}> = Object.freeze({
  gameVersion: '3.3',
  packageId: 'game-base-3.3.0-current',
  phase: 'phase_i',
})
