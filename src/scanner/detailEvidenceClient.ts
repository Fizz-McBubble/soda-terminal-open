import { resolveScannerHelperSessionToken } from './scannerSessionToken'
import { readScannerResultWithDeadline } from './resultRead'

const defaultScannerHelperBaseUrl = 'http://127.0.0.1:43127'

export function createScannerDetailEvidenceClient(
  options: {
    baseUrl?: string
    initialToken?: string
    fetchImpl?: typeof fetch
    createObjectURL?: (blob: Blob) => string
    revokeObjectURL?: (url: string) => void
    requestTimeoutMs?: number
  } = {},
) {
  const baseUrl = options.baseUrl ?? defaultScannerHelperBaseUrl
  const fetchImpl = options.fetchImpl ?? fetch
  const createObjectURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob))
  const revokeObjectURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
  let token = options.initialToken ?? import.meta.env.VITE_SCANNER_HELPER_TOKEN ?? ''
  let tokenResolved = false

  async function resolveToken(signal: AbortSignal) {
    if (tokenResolved && token) return token
    token = await resolveScannerHelperSessionToken({
      baseUrl,
      initialToken: token,
      fetchImpl,
      origin: window.location.origin,
      fallbackErrorCode: 'detail_evidence_token_request_failed',
      signal,
    })
    signal.throwIfAborted()
    tokenResolved = true
    return token
  }

  return async function requestDetailEvidence(resultHandle: string, itemId: string) {
    const { projection, blob } = await readScannerResultWithDeadline(
      async (signal) => {
        const sessionToken = await resolveToken(signal)
        const headers = { 'X-Soda-Scanner-Token': sessionToken }
        const projectionResponse = await fetchImpl(
          `${baseUrl}/api/result/${encodeURIComponent(resultHandle)}/evidence/${encodeURIComponent(itemId)}`,
          { method: 'GET', headers, signal },
        )
        if (!projectionResponse.ok) throw new Error('detail_evidence_projection_unavailable')
        const projection = (await projectionResponse.json()) as {
          availability: 'available'
          detailSrc: string
          visualDetailHash: string
        }
        signal.throwIfAborted()
        const detailUrl = new URL(projection.detailSrc, baseUrl)
        if (
          detailUrl.origin !== new URL(baseUrl).origin ||
          !detailUrl.pathname.startsWith('/api/result/')
        )
          throw new Error('detail_evidence_origin_invalid')
        const imageResponse = await fetchImpl(detailUrl, { method: 'GET', headers, signal })
        if (!imageResponse.ok || !imageResponse.headers.get('content-type')?.startsWith('image/'))
          throw new Error('detail_evidence_image_unavailable')
        const blob = await imageResponse.blob()
        signal.throwIfAborted()
        return { projection, blob }
      },
      undefined,
      options.requestTimeoutMs,
    )
    const detailSrc = createObjectURL(blob)
    return {
      availability: projection.availability,
      detailSrc,
      visualDetailHash: projection.visualDetailHash,
      revoke() {
        revokeObjectURL(detailSrc)
      },
    }
  }
}

export const requestScannerDetailEvidence = createScannerDetailEvidenceClient()
