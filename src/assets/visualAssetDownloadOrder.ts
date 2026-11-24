// Promote an image in the existing full-pack queue when its slot becomes visible.
// This never initiates a fetch, changes the manifest, or consumes another download slot.
const requested = new Set<string>()
let accountPriority: readonly string[] = []

export function prioritizeVisualAsset(url: string) {
  requested.add(url)
}

export function prioritizeAccountVisualAssets(urls: readonly string[]) {
  accountPriority = urls
}

export function* visualAssetDownloadOrder<T extends { remoteUrl: string }>(assets: readonly T[]) {
  const pending = new Set(assets)
  const byUrl = new Map<string, T[]>()
  for (const asset of assets) {
    const matches = byUrl.get(asset.remoteUrl) ?? []
    matches.push(asset)
    byUrl.set(asset.remoteUrl, matches)
  }
  const firstPending = (urls: Iterable<string>) => {
    for (const url of urls) {
      const first = byUrl.get(url)?.find((asset) => pending.has(asset))
      if (first) return first
    }
  }
  while (pending.size) {
    const next =
      firstPending(requested) ?? firstPending(accountPriority) ?? pending.values().next().value!
    pending.delete(next)
    yield next
  }
}
