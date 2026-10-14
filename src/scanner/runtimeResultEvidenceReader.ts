import type { ScannerAssistantCommands } from './runtimeCommands'

export function createResultEvidenceReader(options: {
  command: (path: string, method: string) => Promise<unknown>
  readAuthenticatedImage: (path: string) => Promise<string>
  revokeObjectURL: (url: string) => void
}): NonNullable<ScannerAssistantCommands['requestResultEvidence']> {
  const { command, readAuthenticatedImage, revokeObjectURL } = options
  return async (resultFileHandle, itemId) => {
    const projection = (await command(
      `/api/result/${encodeURIComponent(resultFileHandle)}/evidence/${encodeURIComponent(itemId)}`,
      'GET',
    )) as {
      availability: 'available'
      detailSrc: string
      cardSrc: string
      visualDetailHash: string
    }
    let detailSrc = ''
    let cardSrc = ''
    try {
      detailSrc = await readAuthenticatedImage(projection.detailSrc)
      cardSrc = await readAuthenticatedImage(projection.cardSrc)
      return {
        availability: projection.availability,
        detailSrc,
        cardSrc,
        visualDetailHash: projection.visualDetailHash,
        revoke() {
          revokeObjectURL(detailSrc)
          revokeObjectURL(cardSrc)
        },
      }
    } catch (error) {
      if (detailSrc) revokeObjectURL(detailSrc)
      if (cardSrc) revokeObjectURL(cardSrc)
      throw error
    }
  }
}
