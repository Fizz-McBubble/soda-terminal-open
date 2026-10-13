import type { ComponentProps } from 'react'
import { PlayerConfirmableBangbooSelector } from './PlayerConfirmableBangbooSelector'

/** Recovery and player-confirmed Bangboo controls for an unavailable exact fit. */
export function TeamPlanRecoveryStatus({
  readOnly,
  fitStatus,
  canRecoverTargetFit,
  targetCandidateId,
  bangbooUnavailable,
  needsBangbooChoice,
  memberIds,
  options,
  onConfirm,
  onRetry,
}: {
  readOnly: boolean
  fitStatus: 'idle' | 'running' | 'error'
  canRecoverTargetFit: boolean
  targetCandidateId: string | null
  bangbooUnavailable: boolean
  needsBangbooChoice: boolean
  memberIds: ComponentProps<typeof PlayerConfirmableBangbooSelector>['memberIds']
  options: ComponentProps<typeof PlayerConfirmableBangbooSelector>['options']
  onConfirm: ComponentProps<typeof PlayerConfirmableBangbooSelector>['onConfirm']
  onRetry: () => void
}) {
  return (
    <section className="panel status-card" aria-label="队伍建议详情">
      <h2>
        {readOnly
          ? '账户资料已更新'
          : fitStatus === 'error'
            ? '配装生成失败'
            : canRecoverTargetFit
              ? '正在生成队伍配装'
              : !targetCandidateId
                ? '暂不能为这队配装'
                : bangbooUnavailable
                  ? '暂未找到可用邦布'
                  : needsBangbooChoice
                    ? '确认邦布后生成配装'
                    : '暂不能打开这份配装'}
      </h2>
      <p role={fitStatus === 'error' && !readOnly ? 'alert' : undefined}>
        {readOnly
          ? '返回队伍建议重新分析后，再为这支队伍配装。'
          : fitStatus === 'error'
            ? '配装生成失败；账户资料没有被修改。'
            : canRecoverTargetFit
              ? '正在恢复这支队伍的配装，请稍候。'
              : !targetCandidateId
                ? '当前没有足够的配装依据，请返回选择其他队伍。'
                : bangbooUnavailable
                  ? '当前没有可确认的邦布搭配，请返回选择其他队伍。'
                  : needsBangbooChoice
                    ? '选择要搭配的邦布，再匹配驱动盘；不会修改账户资产。'
                    : '请返回队伍建议，重新选择这支队伍。'}
      </p>
      {needsBangbooChoice && !readOnly ? (
        <PlayerConfirmableBangbooSelector
          memberIds={memberIds}
          options={options}
          pending={fitStatus === 'running' || readOnly}
          onConfirm={onConfirm}
        />
      ) : null}
      {canRecoverTargetFit && fitStatus === 'error' ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          重试生成
        </button>
      ) : null}
    </section>
  )
}
