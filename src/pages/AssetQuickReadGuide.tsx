import { ExplanationPopover } from '../components/ExplanationPopover'
import './scanner-guide.css'

export function AssetQuickReadGuide() {
  return (
    <ExplanationPopover
      label="资产快读指南"
      closeLabel="关闭资产快读指南"
      className="scanner-guide asset-quick-read__guide-entry"
      align="end"
    >
      <dl>
        <div>
          <dt>首次使用</dt>
          <dd>
            当前适配 Windows
            本机游戏。下载并安装资产快读，返回本页连接。填写游戏目录；不确定路径时，使用输入框旁的“如何查找”。
          </dd>
        </div>
        <div>
          <dt>读取顺序</dt>
          <dd>
            先完成游戏更新和首次着色器编译。退出游戏后点击“一键读取”，允许本次管理员权限请求；看到“已就绪”再启动游戏并登录。
          </dd>
        </div>
        <div>
          <dt>读到数据以后</dt>
          <dd>
            核对账户与数量后导入。等级、突破、影画和技能会自动采用本次读取值，之后仍可手动修改。
          </dd>
        </div>
        <div>
          <dt>等待或重试</dt>
          <dd>
            数据齐全即完成，最长等待 3
            分钟。超时或失败后按提示处理，再重新读取；云·绝区零请使用画面扫描。
          </dd>
        </div>
      </dl>
    </ExplanationPopover>
  )
}

export function AssetQuickReadDirectoryGuide() {
  return (
    <ExplanationPopover
      label="如何查找"
      title="查找游戏安装目录"
      closeLabel="关闭目录指引"
      className="scanner-guide asset-quick-read__directory-guide"
      align="end"
    >
      <ol>
        <li>在米哈游启动器的《绝区零》页面，点击“开始游戏”右侧菜单，选择“游戏设置”。</li>
        <li>找到“游戏目录”，点击“打开所在目录”。</li>
        <li>在打开的资源管理器中点击地址栏，复制完整路径。</li>
        <li>回到本页，把路径粘贴进“游戏安装目录”。</li>
      </ol>
      <p>
        目录通常依次为 <code>miHoYo Launcher → games → ZenlessZoneZero Game</code>
        ；以启动器显示的实际位置为准。
      </p>
      <p>
        应选包含 <code>ZenlessZoneZero.exe</code> 和 <code>ZenlessZoneZero_Data</code>{' '}
        的游戏根目录，不要选择 Data 子文件夹或启动器目录。
      </p>
    </ExplanationPopover>
  )
}
