import type { ReactNode } from 'react'
import { assetQuickReadRelease } from '../assetQuickRead/distribution'
import { scannerDistributionManifest } from '../scanner/distribution'
import './tool-block-guidance.css'

export type ToolBlockGuidanceTarget = 'asset_quick_read' | 'scanner' | 'both'

export type ToolBlockGuidanceProps = {
  tool?: ToolBlockGuidanceTarget
  title?: string
  className?: string
  summaryClassName?: string
  as?: 'details' | 'section'
  defaultOpen?: boolean
  children?: ReactNode
}

export function ToolBlockGuidance({
  tool = 'both',
  title = '下载、拦截或连接失败怎么处理',
  className = '',
  summaryClassName = '',
  as = 'details',
  defaultOpen = false,
  children,
}: ToolBlockGuidanceProps) {
  const isAsset = tool === 'asset_quick_read'
  const isScanner = tool === 'scanner'

  const versionText = isAsset ? (
    <p className="tool-block-guidance__versions">
      当前官方下载：资产快读 {assetQuickReadRelease.version}（
      <code>{assetQuickReadRelease.fileName}</code>
      ）。请核对实际下载文件的版本；本页显示的版本不会改变已经下载的旧文件。
    </p>
  ) : isScanner ? (
    <p className="tool-block-guidance__versions">
      当前官方下载：画面扫描 {scannerDistributionManifest.helper.installerVersion}（
      <code>{scannerDistributionManifest.helper.entry}</code>
      ）。请核对实际下载文件的版本；本页显示的版本不会改变已经下载的旧文件。
    </p>
  ) : (
    <p className="tool-block-guidance__versions">
      当前下载：资产快读 {assetQuickReadRelease.version}（
      <code>{assetQuickReadRelease.fileName}</code>）；画面扫描{' '}
      {scannerDistributionManifest.helper.installerVersion}（
      <code>{scannerDistributionManifest.helper.entry}</code>
      ）。请核对实际下载文件的版本；本页显示的版本不会改变已经下载的旧文件。
    </p>
  )

  const content = (
    <div className="tool-block-guidance__content">
      {versionText}
      <ul className="tool-block-guidance__list">
        <li>
          <strong>Chrome“不常被下载”或 SmartScreen“无法识别”：</strong>
          先核对下载来源、文件名与版本。此类提示与安全软件检出不同；仅凭提示无法判断文件安全。仍有疑虑时，保留提示截图并通过问题反馈核查。
        </li>
        <li>
          <strong>安全软件检出或隔离：</strong>在 Windows
          安全中心的“保护历史记录”或安全软件日志中，查看检测名称和被拦截文件。反馈软件名称、检测名称与工具版本；先保留隔离状态，不要直接关闭防护或添加整个目录为排除项。
        </li>
        <li>
          <strong>安装或启动失败：</strong>
          查看安装器详情中的失败阶段。完整性或解压错误可重新下载官方安装包；访问被拒绝需核对目录权限与占用。可在安装反馈页复制或下载诊断，不要仅凭“打不开”判断为杀毒拦截。
        </li>
        <li>
          <strong>工具已启动但网页连接失败：</strong>
          返回准备区查看连接状态和诊断，确认工具正在运行；若使用代理，可核对本地地址是否被代理。连接失败不等于文件被隔离，先反馈诊断，避免反复重装或删除读取结果。
        </li>
      </ul>
      {children}
    </div>
  )

  if (as === 'section') {
    return (
      <section className={`tool-block-guidance ${className}`} aria-label={title}>
        <h4 className="tool-block-guidance__heading">{title}</h4>
        {content}
      </section>
    )
  }

  return (
    <details className={`tool-block-guidance ${className}`} open={defaultOpen ? true : undefined}>
      <summary className={`tool-block-guidance__summary ${summaryClassName}`}>{title}</summary>
      {content}
    </details>
  )
}
