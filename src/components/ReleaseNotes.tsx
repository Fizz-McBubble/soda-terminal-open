import { ExplanationPopover } from './ExplanationPopover'
import './ReleaseNotes.css'

// Keep player-facing changes with the release that ships them, newest first.
const releases = [
  {
    date: '2026-10-09',
    title: '显示适配与驱动盘分析修正',
    changes: [
      '宽屏统一放大导航、文字、按钮和卡片，保持原有页面比例。',
      '主区域使用可用宽度，统一页头与内容边距；短窗口正常滚动。',
      '手机首页隐藏立绘，平板和桌面保留。',
      '修正固定攻击、生命、防御词条的品质换算，补全有依据的护盾用途判断。',
    ],
  },
  {
    date: '2026-10-09',
    title: '单人和队伍选盘优化',
    changes: [
      '从仓库搭配时，结合当前养成、音擎和盘面比较完整配装。',
      '保留队伍需要的功能属性，完善单人和三人配装的推荐、保存与刷新回读。',
    ],
  },
  {
    date: '2026-10-09',
    title: '相同属性盘与 2K 扫描修复',
    changes: [
      '修复多张驱动盘属性完全相同时提前停止的问题，保留每张盘。',
      '修复 2K 全屏回到顶部后重复滚动的问题，统一不同尺寸下的选中边缘检测。',
      '修复月光骑士颂识别后无法对应套装的问题。',
      '反馈保留具体中断原因与出错盘序号，便于定位问题。',
    ],
  },
  {
    date: '2026-10-08',
    title: '扫描稳定性与窗口适配',
    changes: [
      '修复大仓库回顶、连续同款驱动盘选择和翻行时的异常中断。',
      '适配 16:9 游戏窗口，1080p 与 1600×900 已完成 2040 张实扫，无需固定桌面位置。',
      '资产与驱动盘分析默认按扫描时的游戏顺序展示。',
      '补全扫描失败诊断，统一反馈编号；旧助手连接后提示新版本，下载文件名带版本号。',
    ],
  },
  {
    date: '2026-10-08',
    title: '大仓库扫描修复',
    changes: [
      '修复仓库翻动稍慢时提前中断扫描的问题。',
      '复用完全相同的词条识别结果，减少大仓库扫描时的重复运算。',
    ],
  },
  {
    date: '2026-10-08',
    title: '下载与安装体验调整',
    changes: [
      '下载进度收进原按钮，连接和下载按钮等宽对齐，手机端同步适配。',
      '精简重复提示，下载状态与操作指引放在按钮右侧，窄屏空间不足时换行。',
      '调整安装窗口和提示，减少打开后的等待，组件准备过程保持可见。',
    ],
  },
  {
    date: '2026-10-08',
    title: '扫描助手下载与安装',
    changes: [
      '下载显示实际进度与已下载大小，支持取消和重试。',
      '首次打开安装包后自动安装并启动助手；已有安装保留修复和卸载入口。',
      '下载完成后显示下一步操作，返回网页时尝试连接助手。',
    ],
  },
  {
    date: '2026-10-07',
    title: '稳定性与体验优化',
    changes: [
      '改进助手连接、扫描进度恢复和超时提示，继续只扫描 S 级驱动盘。',
      '修复大批量导入时的等待与结果反馈，扫描不完整时明确提示。',
      '大仓库分批展示，筛选仍覆盖全部驱动盘；优化分析等待与失败重试。',
      '修复异常旧账户记录导致首页打不开的问题，保留原数据并给出恢复提示。',
      '统一无效链接页面和部分按钮、弹窗样式，精简重复说明。',
      '顶部新增更新日志，可随时查看每次修复与优化。',
    ],
  },
  {
    date: '2026-10-07',
    title: '扫描助手与图片入口',
    changes: [
      '提供完整扫描助手安装包，支持安装、修复和卸载。',
      '扫描失败可在页面内反馈，诊断信息按需展开。',
      '首页可直接下载并加载图片，两个图片按钮统一尺寸和布局。',
    ],
  },
  {
    date: '2026-10-05',
    title: '配装与仓库体验',
    changes: [
      '优化从仓库搭配的加载反馈，保留当前详情和浏览位置。',
      '完善配装候选与仓库建议的条件说明，修复相关计算边界。',
    ],
  },
] as const

export function ReleaseNotes() {
  return (
    <ExplanationPopover label="更新日志" closeLabel="关闭更新日志" className="release-notes">
      <ol className="release-notes__list">
        {releases.map((release, index) => (
          <li key={`${release.date}-${release.title}`} className="release-notes__entry">
            <div className="release-notes__date">
              <time dateTime={release.date}>{release.date}</time>
              {index === 0 ? <span>最新</span> : null}
            </div>
            <h2>{release.title}</h2>
            <ul>
              {release.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </ExplanationPopover>
  )
}
