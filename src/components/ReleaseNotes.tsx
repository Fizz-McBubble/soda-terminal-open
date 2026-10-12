import { releases } from '../releaseNotes/data'
import { ExplanationPopover } from './ExplanationPopover'
import './ReleaseNotes.css'

export function ReleaseNotes() {
  return (
    <ExplanationPopover label="更新日志" closeLabel="关闭更新日志" className="release-notes">
      <ol className="release-notes__list">
        {releases.map((release, index) => (
          <li key={release.id} className="release-notes__entry">
            <div className="release-notes__date">
              <time dateTime={release.date}>{release.date}</time>
              {index === 0 ? <span>最新</span> : null}
            </div>
            <h2>{release.title}</h2>
            <p className="release-notes__date">适用：{release.scope}</p>
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
