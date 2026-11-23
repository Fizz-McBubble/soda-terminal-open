import { createPinnedInstallerDownload } from './scanner-installer.mjs'
import {
  assetQuickReadInstallerRelease,
  resolveAssetQuickReadInstallerUrl,
  validAssetQuickReadRelease,
} from './asset-quick-read-release.mjs'
export { assetQuickReadInstallerPath } from './asset-quick-read-release.mjs'
export const assetQuickReadInstallerReleasePath = '/downloads/asset-quick-read-release.v1.json'

/** Serve the deployment's current package identity without a stale page cache. */
export function createAssetQuickReadInstallerReleaseDownload({
  manifest = assetQuickReadInstallerRelease,
  validateManifest = validAssetQuickReadRelease,
} = {}) {
  return (request) => {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response(null, {
        status: 405,
        headers: {
          allow: 'GET, HEAD',
          'cache-control': 'no-store',
        },
      })
    if (new URL(request.url).search) return new Response(null, { status: 400 })
    if (!validateManifest(manifest))
      return new Response('下载暂时不可用，请稍后重试。', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      })
    const body = JSON.stringify(manifest)
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(new TextEncoder().encode(body).byteLength),
        'cache-control': 'no-store',
        etag: `"${manifest.sha256}"`,
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    })
  }
}

/** No full-package buffer: reuse the reviewed OCR range and streaming engine. */
export function createAssetQuickReadInstallerDownload({
  manifest = assetQuickReadInstallerRelease,
  ...options
} = {}) {
  return createPinnedInstallerDownload({
    ...options,
    manifest: { ...manifest, assetUrl: resolveAssetQuickReadInstallerUrl(manifest) },
    validateManifest: validAssetQuickReadRelease,
    fileName: manifest.fileName,
    downloadName: manifest.fileName,
  })
}
