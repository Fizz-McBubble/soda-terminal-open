/** Remove collection coordinates from player copy while retaining the observed facts. */
export function retentionPlayerText(value: string) {
  return value
    .replace(/\b\d{5,}:text:\d+(?:-\d+)?\s*[；;]?\s*/giu, '')
    .replace(/\btext:\d+\s*/giu, '')
    .replace(/\bUTF-?16\s*\[\d+\s*:\s*\d+[)\]]\s*/giu, '')
    .replace(/\b(?:spanSha256|bodyHash|contentHash|sha256)\s*[:=]\s*[a-f0-9]{16,}\s*/giu, '')
    .replace(/(^|[；;])\s*0\d{3}(?=[\u3400-\u9fff])/gu, '$1')
    .replace(/(?:^|[；;])\s*(?=[；;])/gu, '')
    .replace(/^[；;\s]+/u, '')
    .trim()
}
