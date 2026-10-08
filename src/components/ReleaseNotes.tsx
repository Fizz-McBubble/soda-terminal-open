import { ExplanationPopover } from './ExplanationPopover'
import './ReleaseNotes.css'

// Keep player-facing changes with the release that ships them, newest first.
const releases = [
  {
    date: '2026-10-08',
    title: '扫描稳定性与窗口适配',
    changes: [
      '修复大仓库回顶、连续同款驱动盘选择和翻行时的异常中断。',
      '适配不同尺寸的 16:9 游戏窗口，1080p 与 1600×900 已完成 2040 张实扫；其他尺寸及云客户端仍待验证。',
      '资产与驱动盘分析默认按扫描时的游戏顺序展示。',
      '补全扫描失败诊断，统一反馈编号；安装包下载文件名加入版本号，精简扫描按钮文案。',
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
