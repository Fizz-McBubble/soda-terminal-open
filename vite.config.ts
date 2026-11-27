import reviewed32MediaUrls from './src/assets/reviewed32-media-urls.json'
import { configDefaults, defineConfig } from 'vitest/config'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import type { Connect, Plugin } from 'vite'
import { catalogCodeSplitting, workerRuntimePayloadSlimming } from './build/catalogCodeSplitting'
import { boxStartupIndexAliases } from './build/boxStartupIndexAliases'
import { communityConsumerPolicySourceHashes } from './build/communityConsumerPolicySourceHashes.mjs'
import { scannerReleaseManifests } from './build/scannerReleaseManifests.mjs'
import { publicBoundaryAliases } from './build/publicBoundaryBinding'
import { projectCommunitySourceText } from './build/communitySourceProjection.mjs'
import { resolveBuildStorage } from './scripts/derived-build-storage.mjs'
import { assetQuickReadInstallerMiddleware } from './scripts/materialize-asset-quick-read-installer.mjs'

function selectedBoundaryAliases() {
  const isRemotePublic = process.env.VITE_SODA_PUBLIC_BUILD === 'true'
  const isCommunity = process.env.VITE_SODA_COMMUNITY_BUILD === 'true'
  return publicBoundaryAliases(isRemotePublic || isCommunity ? 'public' : 'internal')
}

function communitySourceProjectionPlugin(): Plugin {
  const isCommunitySource = (id: string) =>
    process.env.VITE_SODA_COMMUNITY_BUILD === 'true' &&
    id.replaceAll('\\', '/').includes('/app/src/') &&
    !id.includes('?')
  return {
    name: 'soda-community-source-projection',
    enforce: 'pre',
    load(id) {
      if (!isCommunitySource(id) || !id.endsWith('.json')) return null
      return projectCommunitySourceText(readFileSync(id, 'utf8'), id)
    },
    transform(source, id) {
      if (!isCommunitySource(id)) return null
      if (!/\.(?:json|ts|tsx|js|jsx|mjs)(?:\?|$)/u.test(id)) return null
      const projected = projectCommunitySourceText(source, id)
      return projected === source ? null : { code: projected, map: null }
    },
  }
}

const officialAssetSources = [
  { host: 'act-upload.mihoyo.com', pathPrefix: '/nap-obc-indep/' },
  { host: 'fastcdn.hoyoverse.com', pathPrefix: '/content-v2/nap/' },
  { host: 'webstatic.hoyoverse.com', pathPrefix: '/upload/op-public/' },
  { host: 'img.gachabase.net', pathPrefix: '/conv/zzz/assets/' },
  { host: 'i.gachabase.net', pathPrefix: '/' },
  { host: 'static.nanoka.cc', pathPrefix: '/assets/zzz/IconRoleCrop' },
] as const
/** Desktop dev/build cache root. Overridable so a portable or CI checkout never needs the author's
 * absolute path; the production single entry does not use this root at all. */
const derivedStorageRoot = resolveBuildStorage().derivedRoot

/**
 * `vite preview` serves the real public dist on an isolated port for the public journey harness.
 * The API target stays loopback; the private calculation service is always a separate process.
 */
const previewApiTarget = process.env.SODA_PREVIEW_API_TARGET ?? 'http://127.0.0.1:8787'

/**
 * The one visual-asset implementation binds its manifest at build time: the public build resolves the
 * generated display projection, the desktop build the internal manifest. The source audit resolves
 * the same specifier with the same rule (see deploy/prepare-public-shell.mjs), so audit and bundling
 * stay consistent and the worker graph keeps a static, top-level-await-free import.
 */
function publicEntryPlugin(): Plugin {
  return {
    name: 'soda-public-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const community = process.env.VITE_SODA_COMMUNITY_BUILD === 'true'
        if (process.env.VITE_SODA_PUBLIC_BUILD !== 'true' && !community) return html
        const localEntry = '<script type="module" src="/src/main.tsx"></script>'
        if (html.split(localEntry).length !== 2) throw new Error('public_entry_source_missing')
        return html
          .replace(
            localEntry,
            community
              ? '<script type="module" src="/src/main.community.tsx"></script>'
              : '<script type="module" src="/src/main.public.tsx"></script>',
          )
          .replace(
            '</head>',
            community
              ? '    <meta name="soda-bundle-entry" content="browser-compute" />\n    <meta name="soda-compute-mode" content="browser" />\n  </head>'
              : '    <meta name="soda-bundle-entry" content="public" />\n  </head>',
          )
      },
    },
  }
}

function officialCatalogCachePlugin(): Plugin {
  const localManifestPath = new URL('./src/data/visual-assets.v1.json', import.meta.url)
  const internalBuild =
    process.env.VITE_SODA_PUBLIC_BUILD !== 'true' &&
    process.env.VITE_SODA_COMMUNITY_BUILD !== 'true'
  const localOnlySources = new Set<string>()
  if (internalBuild && existsSync(localManifestPath)) {
    const { assets } = JSON.parse(readFileSync(localManifestPath, 'utf8')) as {
      assets: { distribution?: string; remoteUrl: string | null }[]
    }
    for (const asset of assets) {
      if (asset.distribution === 'local-only' && asset.remoteUrl)
        localOnlySources.add(asset.remoteUrl)
    }
  }
  const middleware: Connect.NextHandleFunction = async (request, response, next) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')
    if (requestUrl.pathname !== '/official-catalog-cache') {
      next()
      return
    }
    const source = requestUrl.searchParams.get('source')
    if (!source) {
      response.statusCode = 400
      response.end('缺少官方图鉴素材地址')
      return
    }
    let remote: URL
    try {
      remote = new URL(source)
    } catch {
      response.statusCode = 400
      response.end('官方图鉴素材地址无效')
      return
    }
    const localOnly =
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '') &&
      localOnlySources.has(source)
    const reviewedCommunity = localOnly || Object.values(reviewed32MediaUrls).includes(source)
    if (
      remote.protocol !== 'https:' ||
      (!reviewedCommunity &&
        !officialAssetSources.some(
          (source) =>
            remote.hostname === source.host && remote.pathname.startsWith(source.pathPrefix),
        ))
    ) {
      response.statusCode = 403
      response.end('官方图鉴素材地址不在允许范围内')
      return
    }

    let lastStatus = 502
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        // The manifest hash is recorded from the origin's default byte stream.
        // Do not negotiate a WebP/AVIF variant here, or cache verification will
        // correctly reject a different representation of the same image.
        const upstream = await fetch(remote, {
          redirect: reviewedCommunity ? 'manual' : 'follow',
        })
        lastStatus = upstream.status
        if (upstream.ok) {
          const body = Buffer.from(await upstream.arrayBuffer())
          response.statusCode = 200
          response.setHeader(
            'content-type',
            upstream.headers.get('content-type') ?? 'application/octet-stream',
          )
          response.setHeader('content-length', String(body.byteLength))
          response.setHeader('cache-control', 'private, max-age=0, must-revalidate')
          response.end(body)
          return
        }
        if (upstream.status < 500) break
      } catch {
        lastStatus = 502
      }
      if (attempt < 3)
        await new Promise((resolve) => {
          setTimeout(resolve, attempt * 120)
        })
    }
    // Return a transport-success envelope so an expected upstream outage does
    // not emit an unhandled browser console resource error. The client still
    // treats the explicit header as a failed, retryable asset fetch.
    response.statusCode = 200
    response.setHeader('content-type', 'text/plain; charset=utf-8')
    response.setHeader('cache-control', 'no-store')
    response.setHeader('x-soda-asset-error', 'upstream-unavailable')
    response.setHeader('x-soda-upstream-status', String(lastStatus))
    response.end('官方图鉴素材暂时无法获取')
  }
  return {
    name: 'soda-official-catalog-cache',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  cacheDir: `${derivedStorageRoot}/vite/cache`,
  resolve: {
    // One binding source: the alias below, never a tsconfig path that could mask it.
    tsconfigPaths: false,
    alias: selectedBoundaryAliases(),
  },
  server:
    process.env.VITE_SODA_PUBLIC_BUILD === 'true'
      ? { proxy: { '/api': { target: previewApiTarget, changeOrigin: false } } }
      : undefined,
  preview:
    process.env.VITE_SODA_PUBLIC_BUILD === 'true'
      ? { proxy: { '/api': { target: previewApiTarget, changeOrigin: false } } }
      : undefined,
  build: {
    copyPublicDir: process.env.SODA_FILTER_PUBLIC_DOWNLOADS !== 'true',
    outDir: `${derivedStorageRoot}/vite/dist`,
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          ...(process.env.VITE_SODA_COMMUNITY_BUILD === 'true' ? { minSize: 24_000 } : {}),
          maxSize: 400_000,
          groups: [
            ...(process.env.VITE_SODA_COMMUNITY_BUILD === 'true'
              ? [
                  {
                    name: 'ui-team-intrinsic-index',
                    test: /[/\\]gameDataPacks[/\\]generated[/\\]current31-team-intrinsic-index\.v1\.json$/u,
                    priority: 30,
                  },
                  {
                    name: 'ui-generic-team-ranking',
                    test: /[/\\]gameDataPacks[/\\]generated[/\\]generic-team-ranking\.v1\.json$/u,
                    priority: 30,
                  },
                ]
              : []),
            {
              name: 'catalog',
              test: /soda-catalog:|gameDataPacks[/\\](data|generated)[/\\]/,
              priority: 20,
              entriesAware: true,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10,
              entriesAware: true,
            },
            {
              name: 'application',
              test: /[/\\]src[/\\]/,
              priority: 0,
              entriesAware: true,
            },
          ],
        },
      },
    },
  },
  worker: {
    // The full local Query graph contains module-level async imports. Browser compute uses a
    // module Worker, while the existing remote/public artifact keeps its frozen IIFE behavior.
    format: process.env.VITE_SODA_PUBLIC_BUILD === 'true' ? 'iife' : 'es',
    // Vite builds worker modules with a separate plugin container. Apply the same source
    // projection there or large guide catalogs can bypass the public locator scrub.
    plugins: () => [
      communityConsumerPolicySourceHashes(),
      workerRuntimePayloadSlimming(),
      ...(process.env.VITE_SODA_COMMUNITY_BUILD === 'true'
        ? [
            boxStartupIndexAliases(),
            {
              name: 'soda-community-worker-local-team-view',
              enforce: 'pre' as const,
              resolveId(source: string) {
                if (
                  source === './teamLoadoutDecisionViewModel' ||
                  source === '../teamLoadoutDecisionViewModel'
                ) {
                  // This Worker already owns the local team projection. A top-level
                  // dynamic import of its own grouped dependencies would deadlock.
                  return fileURLToPath(
                    new URL('./src/pages/teamLoadoutDecisionViewModelLocal.ts', import.meta.url),
                  )
                }
                return null
              },
            },
            communitySourceProjectionPlugin(),
            catalogCodeSplitting(projectCommunitySourceText),
          ]
        : []),
    ],
    rolldownOptions:
      process.env.VITE_SODA_COMMUNITY_BUILD === 'true'
        ? {
            output: {
              codeSplitting: {
                // Keep the calculation closure in one static chunk. Splitting its cyclic
                // dependencies again can create cross-chunk initialization cycles.
                includeDependenciesRecursively: true,
                groups: [
                  // These two JSON leaf modules together exceed the static asset limit.
                  // Give each a static chunk before grouping the calculation dependencies.
                  {
                    name: 'worker-team-intrinsic-index',
                    test: /[/\\]gameDataPacks[/\\]generated[/\\]current31-team-intrinsic-index\.v1\.json$/u,
                    priority: 30,
                  },
                  {
                    name: 'worker-generic-team-ranking',
                    test: /[/\\]gameDataPacks[/\\]generated[/\\]generic-team-ranking\.v1\.json$/u,
                    priority: 30,
                  },
                  {
                    // Keep the Worker readiness handshake separate from the account graph.
                    name: 'worker-query-contract',
                    test: /[/\\]src[/\\]application[/\\](?:calculationQueryContract|publicVersionIdentity)\.ts$/u,
                    priority: 35,
                  },
                  // These data leaves have no runtime dependency on the account graph.
                  {
                    name: 'worker-reviewed-team-sources',
                    test: /[/\\]gameDataPacks[/\\]generated[/\\]current31-reviewed-team-source-atoms(?:\.v1\.json|\.ts)$/u,
                    priority: 30,
                  },
                  {
                    name: 'worker-box-startup-templates',
                    test: /soda-box-startup-prepared|[/\\]box-startup-prepared\.v1\.json$/u,
                    priority: 30,
                  },
                  {
                    name: 'worker-box-rating-projection',
                    test: /[/\\]decision[/\\]teamGenericRankingProjection\.ts$/u,
                    priority: 29,
                  },
                  // Keep the first account query's shared dependency closure together.
                  // Full ranking indexes and personal facts retain their own entry points.
                  {
                    name: 'worker-account-query',
                    test: /[/\\]src[/\\](?:application[/\\](?:localCalculationQueryClientCore|calculationQueryDispatch|publicCalculationTransport)|decision[/\\]accountDecisionService)\.ts$/u,
                    priority: 25,
                  },
                  {
                    name: 'worker-planning-event-set32',
                    test: /[/\\]gameDataPacks[/\\]data[/\\]reviewed-planning-event-set32\.v1\.json$/u,
                    priority: 30,
                  },
                  {
                    name: 'worker-box-formation-ranks',
                    test: /[/\\]gameDataPacks[/\\]generated[/\\]box-default-formation-ranks\.3\.3\.json$/u,
                    priority: 30,
                  },
                  {
                    name: 'worker-team-bangboo',
                    test: /[/\\]gameDataPacks[/\\]generated[/\\]team-bangboo-overview\.3\.3\.json$/u,
                    priority: 30,
                  },
                  {
                    name: 'worker-team-directions',
                    test: /soda-catalog:reviewed-team-(?:image|nested)-directions|[/\\]gameDataPacks[/\\]data[/\\]reviewed-team-(?:image|nested|direction-reuse)/u,
                    priority: 25,
                  },
                  {
                    name: 'worker-agent-dev-evidence',
                    test: /soda-catalog:agent-development-evidence|[/\\]agentDevelopmentEvidence\.ts$/u,
                    priority: 25,
                  },
                  {
                    name: 'worker-agent-mechanics',
                    test: /soda-catalog:current-agent-(?:decision-)?mechanic-catalog|[/\\]current-agent-(?:decision-)?mechanic-catalog\.v1\.json$/u,
                    priority: 25,
                  },
                  {
                    name: 'worker-calculation',
                    test: /[/\\]src[/\\]calculation[/\\]/,
                    priority: 20,
                  },
                ],
              },
            },
          }
        : undefined,
  },
  plugins: [
    scannerReleaseManifests(),
    {
      name: 'soda-asset-quick-read-download',
      configureServer(server) {
        server.middlewares.use(assetQuickReadInstallerMiddleware())
      },
    },
    communityConsumerPolicySourceHashes(),
    workerRuntimePayloadSlimming(),
    communitySourceProjectionPlugin(),
    react(),
    publicEntryPlugin(),
    officialCatalogCachePlugin(),
    catalogCodeSplitting(
      process.env.VITE_SODA_COMMUNITY_BUILD === 'true' ? projectCommunitySourceText : undefined,
    ),
  ],
  test: {
    exclude: [...configDefaults.exclude, 'src/performance/**'],
    environment: 'jsdom',
    fileParallelism: false,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      include: ['src/evaluation/**/*.ts'],
      exclude: ['src/evaluation/**/*.test.ts', 'src/evaluation/fixtures.ts'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
})
