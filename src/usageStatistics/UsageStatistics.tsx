import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  setUsageStatisticsAllowed,
  usageStatistics,
  usageStatisticsPreferenceEvent,
} from './client'

export function UsageStatistics() {
  const { pathname } = useLocation()
  useEffect(() => {
    usageStatistics.page(pathname)
  }, [pathname])
  useEffect(() => {
    const frame = requestAnimationFrame(() => usageStatistics.startup())
    const preferenceChange = () => {
      if (!usageStatistics.allowed()) usageStatistics.suspend()
    }
    window.addEventListener('storage', preferenceChange)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('storage', preferenceChange)
    }
  }, [])
  return null
}

export function UsageStatisticsPreference() {
  const [enabled, setEnabled] = useState(usageStatistics.allowed)
  useEffect(() => {
    const refresh = () => setEnabled(usageStatistics.allowed())
    window.addEventListener(usageStatisticsPreferenceEvent, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(usageStatisticsPreferenceEvent, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  if (!usageStatistics.configured()) return null
  return (
    <div className="help-privacy__usage">
      <p>匿名使用统计发送至 Cloudflare，仅含页面类别、操作结果与耗时，不含账户、资产或方案内容。</p>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={usageStatistics.privacyBlocked()}
          onChange={(event) => setUsageStatisticsAllowed(event.target.checked)}
        />
        允许匿名使用统计
      </label>
      {usageStatistics.privacyBlocked() && <p>已遵循浏览器的禁止跟踪设置。</p>}
    </div>
  )
}
