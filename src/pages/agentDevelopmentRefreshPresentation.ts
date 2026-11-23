export type DevelopmentRefreshStage = 'panel' | 'account' | 'analysis'
export type DevelopmentRefreshPhase = 'updating' | 'failed'

const updatingMessages: Record<DevelopmentRefreshStage, string> = {
  panel: '面板更新中…',
  account: '养成建议更新中…',
  analysis: '养成建议更新中…',
}

const failedMessages: Record<DevelopmentRefreshStage, string> = {
  panel: '面板更新失败',
  account: '养成建议更新失败',
  analysis: '养成建议更新失败',
}

export function developmentRefreshNotice({
  stage,
  phase,
}: {
  stage: DevelopmentRefreshStage
  phase: DevelopmentRefreshPhase
  error?: string
}) {
  return {
    message: phase === 'updating' ? updatingMessages[stage] : failedMessages[stage],
    detail: undefined,
  }
}
