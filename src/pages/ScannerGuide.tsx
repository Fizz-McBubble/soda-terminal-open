import { ExplanationPopover } from '../components/ExplanationPopover'
import './scanner-guide.css'

export function ScannerGuide() {
  return (
    <ExplanationPopover
      label="扫描指南"
      closeLabel="关闭扫描指南"
      className="scanner-guide"
      align="start"
    >
      <p>
        推荐使用 1920 × 1080 的窗口或无边框模式。检查的是游戏客户区（实际游戏画面），
        不是显示器分辨率；无需放在默认桌面位置。
      </p>
      <p>
        打开驱动仓库完整列表，清除筛选并关闭遮挡。扫描期间保持游戏完整可见，
        不要移动窗口、改尺寸、切换窗口或操作游戏。仅扫描 S 级驱动盘，A/B 级会跳过。
      </p>
      <p>已实测 1920 × 1080 和 1600 × 900。已有扫描结果也可通过 JSON 文件导入。</p>
    </ExplanationPopover>
  )
}
