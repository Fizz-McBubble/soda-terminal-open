const key = 'soda.asset-quick-read.installation-directory.v1'
const maxLength = 2048

/** Device preference only; never included in accounts, backups or feedback. */
export function readAssetQuickReadDirectory(): string {
  try {
    const value = localStorage.getItem(key)
    return value && value.length <= maxLength ? value.trim() : ''
  } catch {
    return ''
  }
}

export function saveAssetQuickReadDirectory(value: string): void {
  try {
    const directory = value.trim()
    if (!directory) localStorage.removeItem(key)
    else if (directory.length <= maxLength) localStorage.setItem(key, directory)
  } catch {
    // Storage may be unavailable; the current form remains usable.
  }
}
