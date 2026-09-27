import { useEffect, useRef, useState } from 'react'
import { listAccountPlanningDrafts, getAccountPlanningDraft } from '../accounts/planningDrafts'
import type { AccountPlanningDraft } from '../accounts/types'
import type { SodaDatabase } from '../db/database'
import { PlanningDialog } from './TeamSolverWorkspaceParts'
import { savedPlanDisplayName } from '../application/savedPlanDisplayName'

export function sameSavedTeam(plan: AccountPlanningDraft, memberIds: readonly string[]) {
  return (
    plan.kind === 'team' &&
    !plan.teamPortfolioSnapshot &&
    plan.selection.agentIds.length === memberIds.length &&
    memberIds.every((id) => plan.selection.agentIds.includes(id))
  )
}

export async function verifyTeamSaveChoice(
  db: SodaDatabase,
  accountId: string,
  memberIds: readonly string[],
  approved: AccountPlanningDraft | undefined,
) {
  if (approved) {
    const current = await getAccountPlanningDraft(accountId, approved.id, db)
    if (!current || current.revision !== approved.revision)
      throw new Error('已保存方案发生变化，请重新保存并确认。')
  } else if (
    (await listAccountPlanningDrafts(accountId, db)).some((plan) => sameSavedTeam(plan, memberIds))
  ) {
    throw new Error('这支队伍已有保存方案，请再次保存并确认是否覆盖。')
  }
}

export function useTeamSaveConfirmation() {
  const [target, setTarget] = useState<AccountPlanningDraft | null>(null)
  const resolve = useRef<((value: AccountPlanningDraft | null) => void) | null>(null)
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
  const request = async (accountId: string, memberIds: readonly string[], preferredId?: string) => {
    const matches = (await listAccountPlanningDrafts(accountId)).filter((plan) =>
      sameSavedTeam(plan, memberIds),
    )
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
