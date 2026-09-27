type ScannerTokenFetch = typeof fetch

type ResolveScannerHelperSessionTokenOptions = {
  baseUrl: string
  initialToken: string
  fetchImpl: ScannerTokenFetch
  origin: string
  fallbackErrorCode: string
}

/**
 * Prefer a token minted by the native loopback Helper. The Node compatibility
 * helper deliberately has no unauthenticated `/token` route, so its launcher
 * token remains the fallback when that handshake is unavailable.
 */
export async function resolveScannerHelperSessionToken({
  baseUrl,
  initialToken,
  fetchImpl,
  origin,
  fallbackErrorCode,
}: ResolveScannerHelperSessionTokenOptions) {
  try {
    const response = await fetchImpl(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (response.ok) {
      const body = (await response.json()) as { token?: string }
      if (body.token && body.token.length >= 32) return body.token
    }
    if (response.status === 403) throw new Error('helper_pairing_denied')
  } catch (error) {
    if (error instanceof Error && error.message === 'helper_pairing_denied') throw error
    // The native Helper may not be running; keep the launcher-token fallback.
  }

  // A public origin must never read a launcher token from the site server.
  if (new URL(origin).protocol === 'https:') throw new Error(fallbackErrorCode)
  if (initialToken.length >= 32) return initialToken

  const response = await fetchImpl(new URL('/_soda/runtime-config', origin))
  if (!response.ok) throw new Error(`${fallbackErrorCode}_${response.status}`)
  const body = (await response.json()) as { scannerToken?: string }
  if (!body.scannerToken || body.scannerToken.length < 32)
    throw new Error('helper_session_token_missing')
  return body.scannerToken
}
