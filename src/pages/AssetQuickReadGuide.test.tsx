import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  AssetQuickReadGuide,
  AssetQuickReadBlockGuide,
  AssetQuickReadDirectoryGuide,
} from './AssetQuickReadGuide'
import { assetQuickReadRelease } from '../assetQuickRead/distribution'

describe('AssetQuickReadGuide component', () => {
  it('provides reading instructions and directory guide through shared popovers', () => {
    render(<AssetQuickReadGuide />)
    const trigger = screen.getByRole('button', { name: '资产快读指南' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('首次使用')).toBeInTheDocument()
    expect(screen.getByText('读取顺序')).toBeInTheDocument()
    expect(screen.getByText('读到数据以后')).toBeInTheDocument()
    expect(screen.getByText('等待或重试')).toBeInTheDocument()
  })

  it('includes actionable tool block guidance for asset quick read', () => {
    render(<AssetQuickReadGuide />)
    expect(screen.getByText('下载或启动受阻')).toBeInTheDocument()
    expect(screen.getByText('下载、拦截或连接失败怎么处理')).toBeInTheDocument()

    // 1. Distribution constants check
    expect(
      screen.getByText(new RegExp(`资产快读 ${assetQuickReadRelease.version}`)),
    ).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(assetQuickReadRelease.fileName)).length).toBeGreaterThan(
      0,
    )

    // 2. Download reputation check
    expect(screen.getByText(/仅凭提示无法判断文件安全/)).toBeInTheDocument()

    // 3. Antivirus detection and quarantine check
    expect(screen.getByText(/反馈软件名称、检测名称与工具版本/)).toBeInTheDocument()
    expect(screen.getByText(/保护历史记录/)).toBeInTheDocument()
    expect(screen.getByText(/先保留隔离状态/)).toBeInTheDocument()

    // 4. Permission / launch failure check
    expect(screen.getByText(/完整性或解压错误可重新下载官方安装包/)).toBeInTheDocument()

    // 5. Connection failure check
    expect(screen.getByText(/工具已启动但网页连接失败/)).toBeInTheDocument()
    expect(screen.getByText(/本地地址是否被代理/)).toBeInTheDocument()
  })

  it('renders dedicated AssetQuickReadBlockGuide popover entry', () => {
    render(<AssetQuickReadBlockGuide />)
    const trigger = screen.getByRole('button', { name: '下载或启动受阻' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('renders directory guide popover', () => {
    render(<AssetQuickReadDirectoryGuide />)
    const trigger = screen.getByRole('button', { name: '如何查找' })
    expect(trigger).toBeInTheDocument()
    expect(screen.getByText(/查找游戏安装目录/)).toBeInTheDocument()
  })
})
