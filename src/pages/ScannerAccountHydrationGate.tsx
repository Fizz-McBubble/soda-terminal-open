import { useLiveQuery } from 'dexie-react-hooks'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { getPublicFormalImportActiveAccount } from '../application/publicFormalImportAccount'
import { PageHeader } from '../components/ui/PageHeader'
import { database } from '../db/databaseCore'
import { readEntryState } from '../application/entryReadState'

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
  return { activeAccount, accounts, discCounts }
}

export type ScannerAccounts = Awaited<ReturnType<typeof loadScannerAccountState>>

export function ScannerAccountGate({
  children,
}: {
  children: (accountState: ScannerAccounts, refreshAccounts: () => void) => ReactNode
}) {
  const [accountRevision, setAccountRevision] = useState(0)
  const [lastAccountState, setLastAccountState] = useState<ScannerAccounts>()
  const hydrationFocused = useRef(false)
  const read = useLiveQuery(
    async () => ({
      revision: accountRevision,
      result: await readEntryState(
        loadScannerAccountState,
        '暂时无法读取本地账户，原资料与本次结果保留。',
      ),
    }),
    [accountRevision],
  )
  const result = read?.revision === accountRevision ? read.result : undefined
  const accountState = result?.status === 'ready' ? result.data : undefined
  if (accountState !== undefined && accountState !== lastAccountState) {
    setLastAccountState(accountState)
  }
  // A refresh must preserve the mounted task and its completion receipt.
  const displayedAccountState = accountState ?? lastAccountState
  useLayoutEffect(() => {
    if (accountState === undefined || hydrationFocused.current) return
    hydrationFocused.current = true
    const heading = document.querySelector<HTMLElement>('main h1')
    if (!heading) return
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }, [accountState])
  if (displayedAccountState === undefined)
    return (
      <div className="sea-page scanner-web">
        <PageHeader
          title="扫描与导入"
          description="读取游戏资产，再导入当前账户。"
          scope={{ kind: 'local', label: '仅本机处理 · 不自动写入账户' }}
        />
        <section
          className="panel"
          role={result?.status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <h2>{result?.status === 'error' ? '本地账户读取失败' : '正在读取本地账户'}</h2>
          {result?.status === 'error' ? (
            <>
              <p>{result.message}</p>
              <button
                className="button button--primary"
                type="button"
                onClick={() => setAccountRevision((value) => value + 1)}
              >
                重试读取
              </button>
            </>
          ) : (
            <p>请稍候，正在读取账户和驱动盘数量。</p>
          )}
        </section>
      </div>
    )
  return (
    <>
      {result?.status === 'error' && (
        <div role="alert">
          <p>{result.message}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={() => setAccountRevision((value) => value + 1)}
          >
            重试读取
          </button>
        </div>
      )}
      {!accountState && result?.status !== 'error' && (
        <p role="status">正在核对本地账户，原任务保留。</p>
      )}
      <fieldset
        disabled={!accountState}
        aria-label="扫描与导入操作"
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
      >
        {children(displayedAccountState, () => setAccountRevision((value) => value + 1))}
      </fieldset>
    </>
  )
}
