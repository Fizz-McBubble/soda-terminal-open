import type { CalculationQueryClient } from '../application/calculationQueryContract'
import { preparePersonalDevelopmentCapture } from './preparePersonalDevelopmentCapture'
import { rememberPersonalDevelopmentCapture } from './personalDevelopmentSessionStore'
import type { Props } from './agentDevelopmentWorkbenchViewState'

type Request = Omit<Parameters<typeof preparePersonalDevelopmentCapture>[0], 'client'> & {
  client: CalculationQueryClient | null
  canContinue: () => boolean
  setAnalysisVersion: Props['setAnalysisVersion']
}

export async function matchPersonalWorkbench({
  client,
  canContinue,
  setAnalysisVersion,
  ...request
}: Request) {
  if (
    !client?.openPersonalDevelopmentSession ||
    !client.queryPersonalDevelopmentCandidates ||
    !client.queryPersonalDevelopmentRoute ||
    !client.releasePersonalDevelopmentSession ||
    !client.hasPersonalDevelopmentSession
  )
    return 'unsupported' as const
  const capture = await preparePersonalDevelopmentCapture({ ...request, client })
  let current: boolean
  try {
    current = canContinue()
  } catch (error) {
    client.releasePersonalDevelopmentSession(capture.session.sessionId)
    throw error
  }
  if (!current) {
    client.releasePersonalDevelopmentSession(capture.session.sessionId)
    return 'cancelled' as const
  }
  rememberPersonalDevelopmentCapture(capture, client)
  setAnalysisVersion((version) => version + 1)
  return 'published' as const
}
