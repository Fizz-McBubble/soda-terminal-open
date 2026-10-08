import './scanner-guide.css'

export function ScannerGuide() {
  return (
    <details className="scanner-guide">
      <summary>扫描指南</summary>
      <div>
        <p>
          推荐使用 1920 × 1080 的窗口或无边框模式。检查的是游戏客户区（实际游戏画面），
          不是显示器分辨率；无需放在默认桌面位置。
        </p>
        <p>
          打开驱动仓库完整列表，清除筛选并关闭遮挡。扫描期间保持游戏完整可见，
          不要移动窗口、改尺寸、切换窗口或操作游戏。仅扫描 S 级驱动盘，A/B 级会跳过。
        </p>
        <p>已实测 1920 × 1080 和 1600 × 900；其他 16:9 尺寸仍待实机确认。</p>
        <p>
          云·绝区零 Windows 客户端暂未验证；网页版及 Mac 不支持本机扫描。 已有扫描结果仍可通过 JSON
          文件导入。
        </p>
      </div>
    </details>
  )
}
