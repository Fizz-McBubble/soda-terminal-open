import { useState } from 'react'
import { playerErrorMessage } from '../../application/playerErrorMessage'
import { usePageOperationScope } from '../../components/usePageOperationScope'
import type { AgentDevelopmentGoldenProps, GoldenTop10Data } from './types'

export function useTop10SaveFeedback(
  data: GoldenTop10Data,
  selected: number,
  selectedRow: GoldenTop10Data['candidates'][number] | undefined,
  onSavePlan: AgentDevelopmentGoldenProps['onSavePlan'],
) {
  const [saveErrorState, setSaveError] = useState<{
    scope: string
    message: string
  } | null>(null)
  const [saveMessage, setSaveMessage] = useState<{
    key: string
    message: string
    savedPlanUrl?: string
  } | null>(null)
  const saveScope = JSON.stringify([data.panelScopeKey, data.saveScopeKey, selected])
  const captureSaveScope = usePageOperationScope(saveScope)
  const [savingScope, setSavingScope] = useState<string | null>(null)
  const saving = savingScope === saveScope
  const saveError = saveErrorState?.scope === saveScope ? saveErrorState.message : null
  const save = () => {
    if (!onSavePlan || !selectedRow) return
    const saveKey = `${saveScope}:${selectedRow.rank}:${selectedRow.discIds?.join('|') ?? ''}`
    const isCurrentSave = captureSaveScope()
    setSaveError(null)
    setSaveMessage(null)
    setSavingScope(saveScope)
    void Promise.resolve(onSavePlan(selectedRow.rank))
      .then((result) => {
        if (isCurrentSave())
          setSaveMessage({
            key: saveKey,
            message: result?.refreshPending
              ? '方案已保存，匹配结果暂未更新，请稍后重新匹配。'
              : '已保存到 Soda；游戏内装备未改动。',
            savedPlanUrl: result?.savedPlanUrl,
          })
      })
      .catch((error: unknown) => {
        if (isCurrentSave())
          setSaveError({
            scope: saveScope,
            message: playerErrorMessage(error, '保存失败，请稍后重试。'),
          })
      })
      .finally(() => {
        if (isCurrentSave()) setSavingScope(null)
      })
  }

  return { save, saving, saveError, saveMessage, saveScope }
}
