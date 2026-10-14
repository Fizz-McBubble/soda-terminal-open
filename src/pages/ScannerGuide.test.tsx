import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScannerGuide, ScannerBlockGuide } from './ScannerGuide'
import { scannerDistributionManifest } from '../scanner/distribution'

describe('ScannerGuide component', () => {
  it('provides the supported scanning instructions through the shared popover', () => {
    render(<ScannerGuide />)
    const trigger = screen.getByRole('button', { name: '画面扫描指南' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/保持游戏画面完整可见/)).toBeInTheDocument()
    expect(screen.getByText(/工作区内的“停止”/)).toBeInTheDocument()
    expect(screen.getByText(/自动校验，点击“导入”/)).toBeInTheDocument()
  })

  it('includes actionable tool block guidance covering all four failure modes', () => {
    render(<ScannerGuide />)
    expect(screen.getByText('下载或启动受阻')).toBeInTheDocument()
    expect(screen.getByText('下载、拦截或连接失败怎么处理')).toBeInTheDocument()

    // 1. Distribution constants check
    expect(
      screen.getByText(
        new RegExp(`画面扫描 ${scannerDistributionManifest.helper.installerVersion}`),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(new RegExp(scannerDistributionManifest.helper.entry)).length,
    ).toBeGreaterThan(0)

    // 2. Download reputation check
    expect(screen.getByText(/仅凭提示无法判断文件安全/)).toBeInTheDocument()

    // 3. Antivirus detection and quarantine check
    expect(screen.getByText(/反馈软件名称、检测名称与工具版本/)).toBeInTheDocument()
    expect(screen.getByText(/保护历史记录/)).toBeInTheDocument()
    expect(screen.getByText(/先保留隔离状态/)).toBeInTheDocument()

    // 4. Permission / integrity / launch failure check
    expect(screen.getByText(/完整性或解压错误可重新下载官方安装包/)).toBeInTheDocument()

    // 5. Connection failure check
    expect(screen.getByText(/工具已启动但网页连接失败/)).toBeInTheDocument()
    expect(screen.getByText(/本地地址是否被代理/)).toBeInTheDocument()
  })

  it('renders dedicated ScannerBlockGuide popover entry', () => {
    render(<ScannerBlockGuide />)
    const trigger = screen.getByRole('button', { name: '下载或启动受阻' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  })
})
