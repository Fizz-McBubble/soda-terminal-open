import { useEffect } from 'react'
import { focusScannerWorkspaceTarget } from './scannerWorkbenchNavigation'

export function ScannerWorkbenchNavigation() {
  useEffect(() => {
    const target = document.getElementById(window.location.hash.slice(1))
    if (target?.closest('.scanner-workbench')) focusScannerWorkspaceTarget(target)
  }, [])
  return (
    <>
      <h1 id="scanner-page-heading" className="scanner-workbench__page-heading">
        扫描与导入
      </h1>
    </>
  )
}
