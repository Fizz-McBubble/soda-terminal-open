import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScannerGuide, ScannerBlockGuide } from './ScannerGuide'
import { scannerDistributionManifest } from '../scanner/distribution'
import { installerReleaseUrl, parseInstallerRelease } from '../scanner/installerRelease'
import installerManifest from '../../public/downloads/scanner-installer-release.v1.json'

const publication = vi.hoisted(() => ({ state: null as 'published' | 'not_published' | null }))
vi.mock('../scanner/distribution', async (importOriginal) => {
  const { scannerDistributionFixture } = await import('../testing/scannerManifestFixture')
  return scannerDistributionFixture(
    await importOriginal<typeof import('../scanner/distribution')>(),
    () => publication.state,
  )
})

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

  it.each(['published', 'not_published'] as const)(
    'matches installer availability and the shipped package identity (%s)',
    (state) => {
      publication.state = state
      try {
        render(<ScannerGuide />)
        const version = scannerDistributionManifest.helper.installerVersion
        const fileName = 'Soda-Scanner-Setup.exe'
        expect(version).toBe(installerManifest.version)
        if (state === 'published') {
          expect(screen.getByText(fileName, { selector: 'code' }).closest('p')).toHaveTextContent(
            `当前官方下载：画面扫描 ${version}（${fileName}）。`,
          )
        } else {
          expect(screen.getByText(`画面扫描 ${version} 尚未提供下载。`)).toBeInTheDocument()
          expect(screen.queryByText(fileName, { selector: 'code' })).not.toBeInTheDocument()
        }
        expect(installerReleaseUrl).toBe('/downloads/scanner-installer-release.v1.json')
        expect(scannerDistributionManifest.helper.downloadUrl).toBe(`/downloads/${fileName}`)
        expect(
          parseInstallerRelease({ ...installerManifest, releaseState: 'published' }),
        ).toMatchObject({
          version,
          downloadUrl: `/downloads/${fileName}`,
          fileName: `SodaTerminal-Scanner-Setup-${version}.exe`,
        })
        if (installerManifest.releaseState !== 'published')
          expect(() => parseInstallerRelease(installerManifest)).toThrow(
            'invalid_installer_release',
          )
      } finally {
        publication.state = null
      }
    },
  )

  it('renders dedicated ScannerBlockGuide popover entry', () => {
    render(<ScannerBlockGuide />)
    const trigger = screen.getByRole('button', { name: '下载或启动受阻' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  })
})
