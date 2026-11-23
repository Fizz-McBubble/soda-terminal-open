import type { CalculationQueryClient } from './calculationQueryContract'

export function scopedPersonalDevelopmentClient(
  queryClient: CalculationQueryClient,
  state: { active: boolean; identity: { accountId: string | null }; personalSessions: Set<string> },
  accountId: string | null,
  accountIdentity: { accountId: string | null },
  guarded: <T>(operation: () => Promise<T>) => Promise<T>,
): Pick<
  CalculationQueryClient,
  | 'openPersonalDevelopmentSession'
  | 'queryPersonalDevelopmentCandidates'
  | 'queryPersonalDevelopmentRoute'
  | 'releasePersonalDevelopmentSession'
  | 'hasPersonalDevelopmentSession'
> {
  const queryPersonal = <T>(sessionId: string, operation: () => Promise<T>) =>
    guarded(async () => {
      if (!state.personalSessions.has(sessionId))
        throw new Error('个人搭配会话已释放，请重新搭配。')
      const result = await operation()
      if (!state.personalSessions.has(sessionId))
        throw new Error('个人搭配会话已更新，请重新搭配。')
      return result
    })
  return {
    openPersonalDevelopmentSession: queryClient.openPersonalDevelopmentSession
      ? async (query, options) => {
          if (query.input.warehouse.accountId !== accountId)
            throw new Error('个人搭配输入不属于当前账户。')
          state.personalSessions.add(query.sessionId)
          try {
            return await queryPersonal(query.sessionId, () =>
              queryClient.openPersonalDevelopmentSession!(query, options),
            )
          } catch (error) {
            state.personalSessions.delete(query.sessionId)
            queryClient.releasePersonalDevelopmentSession?.(query.sessionId)
            throw error
          }
        }
      : undefined,
    queryPersonalDevelopmentCandidates: queryClient.queryPersonalDevelopmentCandidates
      ? (query, options) =>
          queryPersonal(query.sessionId, () => {
            if (query.accountId !== accountId) throw new Error('个人搭配输入不属于当前账户。')
            return queryClient.queryPersonalDevelopmentCandidates!(query, options)
          })
      : undefined,
    queryPersonalDevelopmentRoute: queryClient.queryPersonalDevelopmentRoute
      ? (query, options) =>
          queryPersonal(query.sessionId, () => {
            if (query.accountId !== accountId) throw new Error('个人搭配输入不属于当前账户。')
            return queryClient.queryPersonalDevelopmentRoute!(query, options)
          })
      : undefined,
    releasePersonalDevelopmentSession: queryClient.releasePersonalDevelopmentSession
      ? (sessionId) => {
          state.personalSessions.delete(sessionId)
          queryClient.releasePersonalDevelopmentSession!(sessionId)
        }
      : undefined,
    hasPersonalDevelopmentSession: queryClient.hasPersonalDevelopmentSession
      ? (sessionId) =>
          state.active &&
          state.identity === accountIdentity &&
          state.personalSessions.has(sessionId) &&
          queryClient.hasPersonalDevelopmentSession!(sessionId)
      : undefined,
  }
}

export function releaseScopedPersonalSessions(
  client: CalculationQueryClient,
  sessions: Set<string>,
) {
  for (const id of sessions) client.releasePersonalDevelopmentSession?.(id)
  sessions.clear()
}

export function scopedAccountRunGuard(
  runs: Set<string>,
  guarded: <T>(operation: () => Promise<T>) => Promise<T>,
) {
  return <T>(runId: string, operation: () => Promise<T>) =>
    guarded(async () => {
      if (!runs.has(runId)) throw new Error('分析结果已释放，请在当前账户重新分析。')
      const result = await operation()
      if (!runs.has(runId)) throw new Error('分析结果已更新，请使用新的分析结果。')
      return result
    })
}

export function scopedAccountEpochGuard(
  state: { active: boolean; identity: { accountId: string | null }; epoch: number },
  accountIdentity: { accountId: string | null },
) {
  const assertCurrent = (epoch: number) => {
    if (!state.active || state.identity !== accountIdentity || state.epoch !== epoch)
      throw new Error('账户已切换，请在当前账户重新分析。')
  }
  const guarded = async <T>(operation: () => Promise<T>) => {
    const epoch = state.epoch
    assertCurrent(epoch)
    const result = await operation()
    assertCurrent(epoch)
    return result
  }
  return guarded
}
