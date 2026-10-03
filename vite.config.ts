import reviewed32MediaUrls from './src/assets/reviewed32-media-urls.json'
import { configDefaults, defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import type { Connect, Plugin } from 'vite'
import { catalogCodeSplitting } from './build/catalogCodeSplitting'
import { publicBoundaryAliases } from './build/publicBoundaryBinding'
import { projectCommunitySourceText } from './build/communitySourceProjection.mjs'

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
const derivedStorageRoot = process.env.SODA_DERIVED_ROOT ?? 'node_modules/.tmp/soda-derived'

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
    const reviewedCommunity = Object.values(reviewed32MediaUrls).includes(source)
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
        const upstream = await fetch(remote, { redirect: reviewedCommunity ? 'manual' : 'follow' })
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
    outDir: `${derivedStorageRoot}/vite/dist`,
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          maxSize: 400_000,
          groups: [
            {
              name: 'catalog',
              test: /soda-catalog:|gameDataPacks[/\\](data|generated)[/\\]/,
              priority: 20,
              entriesAware: true,
            },
            { name: 'vendor', test: /node_modules/, priority: 10, entriesAware: true },
            { name: 'application', test: /[/\\]src[/\\]/, priority: 0, entriesAware: true },
          ],
        },
      },
    },
  },
  worker: {
    // The full local Query graph contains module-level async imports. Browser compute uses a
    // module Worker, while the existing remote/public artifact keeps its frozen IIFE behavior.
    format: process.env.VITE_SODA_COMMUNITY_BUILD === 'true' ? 'es' : 'iife',
    // Vite builds worker modules with a separate plugin container. Apply the same source
    // projection there or large guide catalogs can bypass the public locator scrub.
    plugins: () =>
      process.env.VITE_SODA_COMMUNITY_BUILD === 'true'
        ? [communitySourceProjectionPlugin(), catalogCodeSplitting(projectCommunitySourceText)]
        : [],
  },
  plugins: [
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
