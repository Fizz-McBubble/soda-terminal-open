import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import {
  AssetCaptureMethodsNotice,
  AssetCaptureRiskNotice,
  AssetCaptureRiskDetails,
} from './AssetCaptureMethodsNotice'

it('keeps the persistent risk notice to one statement with details and official terms', () => {
  render(<AssetCaptureRiskNotice />)
  const notice = screen.getByRole('complementary', { name: '非官方工具风险提示' })
  expect(notice).toHaveTextContent('存在账号处罚风险，无法保证账号安全')
  expect(notice.querySelectorAll(':scope > p')).toHaveLength(1)
  expect(within(notice).getByRole('button', { name: '风险说明' })).toBeInTheDocument()
  expect(within(notice).getByRole('link', { name: '游戏协议' })).toHaveAttribute(
    'href',
    'https://fastcdn.mihoyo.com/static-resource-v2/2025/12/30/f91a0c8796a63ce69bb054d096371593_7574548664798296571.pdf',
  )
})

it('compares only the scope, prerequisites and limits players need to choose a method', () => {
  render(<AssetCaptureMethodsNotice />)
  const scan = screen.getByRole('article', { name: '画面扫描说明' })
  const quick = screen.getByRole('article', { name: '资产快读说明' })
  expect(quick).toHaveTextContent('S 级驱动盘、代理人养成，以及当前装备的驱动盘和音擎')
  expect(scan).toHaveTextContent('云·绝区零')
  expect(quick).toHaveTextContent('需要重新登录')
  expect(quick).toHaveTextContent('不操作鼠标')
  expect(scan).toHaveTextContent('文字识别可能出错')
  expect(scan).toHaveTextContent('代理人养成与音擎沿用你在资产中填写的信息')
  expect(quick).toHaveTextContent('从当前装备出发，对比换装后的面板和近似输出')
  expect(quick).toHaveTextContent('未读到的潜能保留原值')
  expect(quick).not.toHaveTextContent('游戏面板校对')
  expect(within(quick).getByRole('button', { name: '测试' })).toHaveAttribute('popovertarget')
  expect(screen.queryByRole('heading', { name: '能帮你做什么' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('retains distinct driver, privacy and uncertainty information without repeating import instructions', () => {
  render(<AssetCaptureRiskDetails />)
  expect(screen.getByText(/未取得官方书面授权/)).toHaveTextContent('没有依据比较封号概率')
  expect(screen.getByText(/启动均需管理员权限/)).toHaveTextContent('停止读取不会自动卸载驱动')
  expect(screen.getByText(/资产在本机处理/)).toHaveTextContent(
    '不读取账号密码，不上传或保存原始流量、密钥',
  )
  expect(screen.queryByText(/核对.*导入/)).not.toBeInTheDocument()
})
