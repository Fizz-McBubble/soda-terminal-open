import { ExplanationPopover } from '../components/ExplanationPopover'
import './scanner-guide.css'

export function ScannerGuide() {
  return (
    <ExplanationPopover
      label="画面扫描指南"
      closeLabel="关闭画面扫描指南"
      className="scanner-guide"
      align="end"
    >
      <dl>
        <div>
          <dt>准备游戏</dt>
          <dd>打开驱动仓库，清除筛选并关闭弹窗和侧栏，保持游戏画面完整可见。</dd>
        </div>
        <div>
          <dt>开始与停止</dt>
          <dd>
            连接工具后点击“开始扫描”，画面检查通过才会扫描。需要结束时，点击工作区内的“停止”；A/B
            级驱动盘会自动跳过。
          </dd>
        </div>
        <div>
          <dt>扫描与导入</dt>
          <dd>
            扫描完成后自动校验，点击“导入”即可保存到所选账户。有疑问的词条可单独修正；已有扫描 JSON
            可直接使用页上文件入口。
          </dd>
        </div>
        <div>
          <dt>无法开始</dt>
          <dd>按页面提示处理窗口或权限问题，再重试。仍无法解决时，可在失败提示中反馈问题。</dd>
        </div>
      </dl>
    </ExplanationPopover>
  )
}
