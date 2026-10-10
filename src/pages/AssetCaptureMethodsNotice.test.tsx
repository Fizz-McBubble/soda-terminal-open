import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AssetCaptureMethodsNotice } from './AssetCaptureMethodsNotice'

it('states shared uncertainty for both methods and links the official terms', () => {
  render(<AssetCaptureMethodsNotice />)
  expect(screen.getByRole('region', { name: '采集方式与风险说明' })).toHaveTextContent(
    '画面扫描和资产快读均为非官方第三方采集方式',
  )
  expect(screen.getByText(/未取得米哈游对这些方式的书面授权/)).toHaveTextContent(
    '没有依据比较两者的封号概率',
  )
  expect(screen.getByRole('link', { name: /游戏使用许可及服务协议/ })).toHaveAttribute(
    'href',
    'https://fastcdn.mihoyo.com/static-resource-v2/2025/12/30/f91a0c8796a63ce69bb054d096371593_7574548664798296571.pdf',
  )
})

it('accurately distinguishes elevation, capture dependencies and supported scope', () => {
  render(<AssetCaptureMethodsNotice />)
  const scanner = screen.getByRole('article', { name: '画面扫描' })
  const quickRead = screen.getByRole('article', { name: '资产快读（实验）' })
  expect(scanner).toHaveTextContent('实际启动会请求管理员权限')
  expect(scanner).toHaveTextContent('不额外安装网络捕获驱动，不解析游戏通信')
  expect(scanner).toHaveTextContent('无需重新登录')
  expect(scanner).toHaveTextContent('OCR 可能误识别或漏读')
  expect(quickRead).toHaveTextContent('独立组件、管理员权限及 WinDivert 网络驱动')
  expect(quickRead).toHaveTextContent('不自动点击游戏')
  expect(quickRead).toHaveTextContent('不建立音擎或邦布库存')
  expect(quickRead).toHaveTextContent('本机国服 3.2 已两次取得数据，关键数值核对通过')
  expect(quickRead).toHaveTextContent('不代表支持其他版本或覆盖所有资产')
  expect(quickRead).toHaveTextContent('所需数据齐全后立即反馈')
  expect(within(scanner).getByRole('heading', { name: '要求与局限' })).toBeVisible()
})

it('makes the notice immediately readable without confirmation or any capture controls', () => {
  render(<AssetCaptureMethodsNotice />)
  expect(screen.getByRole('heading', { name: '画面扫描' })).toBeVisible()
  expect(screen.getByRole('heading', { name: '资产快读（实验）' })).toBeVisible()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByText(/两种方式均在本地处理数据/)).toHaveTextContent(
    '导入前请核对目标账户与内容',
  )
  expect(screen.getByText(/两种方式均在本地处理数据/)).toHaveTextContent(
    '不读取账号密码，不上传或保存原始流量、密钥',
  )
})
