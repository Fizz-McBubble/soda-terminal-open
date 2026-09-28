import { useState } from 'react'
import { getActiveAccount, getAccountRoster } from '../accounts/repository'
import { saveAgentWEngineAssignment } from '../accounts/wEngineAssignment'
import type { AccountRoster } from '../assault/types'
import { publicAssetCatalog } from '../application/publicAssetCatalog'
import { AgentEditor } from '../components/assets/r6/AgentEditor'
import type { AssetGoldenProps, TypedAssetSave } from '../components/assets/r6/types'
import { PlanningDialog } from './TeamSolverWorkspaceParts'
import './agent-development-current-editor.css'

export function AgentDevelopmentCurrentEditor({
  accountId,
  agentId,
  roster,
  onCancel,
  onSaved,
}: {
  accountId: string
  agentId: string
  roster: AccountRoster
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [message, setMessage] = useState('')
  const item = publicAssetCatalog.agents.find((entry) => entry.stableId === agentId)
  if (!item) return null

  async function save(payload: TypedAssetSave): Promise<string | null> {
    if (payload.kind !== 'agents') return null
    try {
      const active = await getActiveAccount()
      if (active?.id !== accountId) throw new Error('当前账户已经切换，请刷新后重新确认。')
      const current = await getAccountRoster(accountId)
      const source = current.agents.find((agent) => agent.agentId === agentId)
      if (!source || JSON.stringify({ source }) !== payload.baseRevision)
        throw new Error('代理人资料已更新，请刷新后重新确认。')
      const {
        wEngineCatalogId,
        wEngineLevel,
        wEngineRefinement,
        wEngineRefinementManuallySet,
        ...agentPatch
      } = payload.draft
      const savedRoster = await saveAgentWEngineAssignment({
        accountId,
        agentId,
        baseRevision: payload.baseRevision,
        draft: {
          wEngineCopyId: payload.draft.wEngineCopyId,
          wEngineCatalogId,
          wEngineLevel,
          wEngineRefinement,
          wEngineRefinementManuallySet,
        },
        agentPatch,
        agents: publicAssetCatalog.agents,
        wengines: publicAssetCatalog.wengines,
      })
      const savedAgent = savedRoster.agents.find((agent) => agent.agentId === agentId)
      if (!savedAgent) throw new Error('代理人资料保存后未能重新读取。')
      await onSaved()
      return JSON.stringify({ source: savedAgent })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。')
      return null
    }
  }

  const editorProps = {
    accountId,
    roster,
    catalog: publicAssetCatalog,
    onSave: save,
  } satisfies Pick<AssetGoldenProps, 'accountId' | 'roster' | 'catalog' | 'onSave'>
  return (
    <PlanningDialog
      title="编辑当前状态"
      description="保存后同步更新我的资产中的代理人资料。"
      onCancel={onCancel}
    >
      <div className="r6-golden r6-golden--content-only agent-development-current-editor">
        <div className="editor">
          {message && <p role="alert">{message}</p>}
          <AgentEditor props={editorProps} item={item} />
          <div className="agent-development-current-editor__actions">
            <button className="button" type="button" onClick={onCancel}>
              取消编辑
            </button>
          </div>
        </div>
      </div>
    </PlanningDialog>
  )
}
