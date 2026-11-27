import { ExplanationPopover } from '../components/ExplanationPopover'
import { ToolBlockGuidance } from '../components/ToolBlockGuidance'
import './scanner-guide.css'

export { ToolBlockGuidance }

export function ScannerGuide() {
  return (
    <ExplanationPopover
      label="画面扫描指南"
      closeLabel="关闭画面扫描指南"
      className="scanner-guide"
      align="end"
      variant="button"
    >
      <dl>
        <div>
          <dt>准备游戏</dt>
          <dd>打开驱动仓库，清除筛选并关闭弹窗和侧栏，保持游戏画面完整可见。</dd>
        </div>
        <div>
          <dt>开始与停止</dt>
          <dd>
            连接工具后点击“开始扫描”，画面检查通过后会扫描 S
            级盘。点击“停止本次扫描”即可中止，本次结果不会导入。
          </dd>
        </div>
        <div>
          <dt>扫描与导入</dt>
          <dd>
            先核对目标账户和识别数量，有待校准项时先修正再确认导入。只有已确认的 S
            级盘记录会被替换。已有扫描结果可从“选择本机文件（JSON）”打开。
          </dd>
        </div>
        <div>
          <dt>无法开始</dt>
          <dd>按页面提示处理窗口或权限问题，再重试。仍无法解决时，可在失败提示中反馈问题。</dd>
        </div>
        <div>
          <dt>下载或启动受阻</dt>
          <dd>
            <ToolBlockGuidance tool="scanner" title="下载、拦截或连接失败怎么处理" />
          </dd>
        </div>
      </dl>
    </ExplanationPopover>
  )
}

export function ScannerBlockGuide() {
  return (
    <ExplanationPopover
      label="下载或启动受阻"
      title="画面扫描下载与启动故障排查"
      closeLabel="关闭排查指南"
      className="scanner-guide"
      align="end"
    >
      <ToolBlockGuidance tool="scanner" as="section" />
    </ExplanationPopover>
  )
}
