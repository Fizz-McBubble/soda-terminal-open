import { useEffect, useRef, useState } from 'react'
import { listAccountPlanningDrafts, getAccountPlanningDraft } from '../accounts/planningDrafts'
import type { AccountPlanningDraft } from '../accounts/types'
import type { SodaDatabase } from '../db/database'
import { sameSavedTeam } from '../accounts/savedTeamRatingPlayIdentity'
import { PlanningDialog } from './TeamSolverWorkspaceParts'
import { savedPlanDisplayName } from '../application/savedPlanDisplayName'
import { usePageOperationScope } from '../components/usePageOperationScope'

export { sameSavedTeam } from '../accounts/savedTeamRatingPlayIdentity'

export async function verifyTeamSaveChoice(
  db: SodaDatabase,
  accountId: string,
  memberIds: readonly string[],
  approved: AccountPlanningDraft | undefined,
) {
  if (approved) {
    const current = await getAccountPlanningDraft(accountId, approved.id, db)
    if (
      approved.accountId !== accountId ||
      !current ||
      current.revision !== approved.revision ||
      !sameSavedTeam(current, memberIds, approved.solutionContext?.ratedTeamPlayId)
    )
      throw new Error('已保存方案发生变化，请重新保存并确认。')
  }
}

export function useTeamSaveConfirmation() {
  const [target, setTarget] = useState<AccountPlanningDraft | null>(null)
  const resolve = useRef<((value: AccountPlanningDraft | null) => void) | null>(null)
  const capturePageScope = usePageOperationScope('team-save-confirmation')
  useEffect(
    () => () => {
      resolve.current?.(null)
    },
    [],
  )
  const finish = (approved: boolean) => {
    resolve.current?.(approved ? target : null)
    resolve.current = null
    setTarget(null)
  }
  const request = async (
    accountId: string,
    memberIds: readonly string[],
    preferredId?: string,
    playId?: string | null,
  ) => {
    const isCurrentPage = capturePageScope()
    const matches = (await listAccountPlanningDrafts(accountId)).filter((plan) =>
      sameSavedTeam(plan, memberIds, playId),
    )
    if (!isCurrentPage()) return null
    const existing = matches.find((plan) => plan.id === preferredId) ?? matches.at(-1)
    if (!existing) return undefined
    setTarget(existing)
    return new Promise<AccountPlanningDraft | null>((done) => {
      resolve.current = done
    })
  }
  const dialog = target ? (
    <PlanningDialog
      title="覆盖已保存队伍？"
      description={`已有“${savedPlanDisplayName(target)}”，是否用当前配装覆盖？`}
      onCancel={() => finish(false)}
    >
      <div className="button-row">
        <button type="button" autoFocus onClick={() => finish(false)}>
          取消
        </button>
        <button type="button" className="primary-action" onClick={() => finish(true)}>
          覆盖保存
        </button>
      </div>
    </PlanningDialog>
  ) : null
  return { request, dialog }
}
