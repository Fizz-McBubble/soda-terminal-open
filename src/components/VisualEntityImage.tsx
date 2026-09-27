/**
 * One image component for every build: the public distribution ships a generated display projection
 * of the same catalog, so loading, caching, preloading, invalidation and the missing/failed-asset
 * fallback stay identical instead of degrading to a placeholder-only experience.
 */
export { VisualEntityImage } from './VisualEntityImageLocal'
