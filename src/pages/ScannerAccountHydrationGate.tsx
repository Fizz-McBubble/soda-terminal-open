import { useLiveQuery } from 'dexie-react-hooks'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { getPublicFormalImportActiveAccount } from '../application/publicFormalImportAccount'
import { PageHeader } from '../components/ui/PageHeader'
import { database } from '../db/databaseCore'

async function loadScannerAccountState() {
  const activeAccount = await getPublicFormalImportActiveAccount(database)
  const accounts = await database.accounts.where('status').equals('active').sortBy('createdAt')
  const discCounts = new Map(
    await Promise.all(
      accounts.map(
        async (account) =>
          [
            account.id,
            await database.accountDriveDiscs.where('accountId').equals(account.id).count(),
          ] as const,
      ),
    ),
  )
  const assetCounts = new Map(
    await Promise.all(
      accounts.map(async (account) => {
        const roster = (await database.accountRosters.get(account.id))?.roster
        return [
          account.id,
          {
            agents: roster?.agents.filter((agent) => agent.owned).length ?? 0,
          },
        ] as const
      }),
    ),
  )
  return { activeAccount, accounts, discCounts, assetCounts }
}

export type ScannerAccounts = Awaited<ReturnType<typeof loadScannerAccountState>>

export function ScannerAccountGate({
  children,
}: {
  children: (accountState: ScannerAccounts, refreshAccounts: () => void) => ReactNode
}) {
  const [accountRevision, setAccountRevision] = useState(0)
  const hydrationFocused = useRef(false)
  const accountState = useLiveQuery(loadScannerAccountState, [accountRevision])
  useLayoutEffect(() => {
    if (accountState === undefined || hydrationFocused.current) return
    hydrationFocused.current = true
    const heading = document.querySelector<HTMLElement>('main h1')
    if (!heading) return
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }, [accountState])
  if (accountState === undefined)
    return (
      <div className="sea-page scanner-web">
        <PageHeader
          title="扫描与导入"
          description="扫描游戏中的驱动盘，核对结果后，由你确认导入当前账户。"
          scope={{ kind: 'local', label: '仅本机处理 · 不自动写入账户' }}
        />
        <section className="panel" role="status" aria-live="polite">
          <h2>正在读取本地账户</h2>
          <p>请稍候，正在读取账户和驱动盘数量。</p>
        </section>
      </div>
    )
  return children(accountState, () => setAccountRevision((value) => value + 1))
}
