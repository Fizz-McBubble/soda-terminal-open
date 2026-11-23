import { useState } from 'react'
import { releases } from '../releaseNotes/data'
import { ExplanationPopover } from './ExplanationPopover'
import './ReleaseNotes.css'

function ReleaseChanges({ changes }: { changes: readonly string[] }) {
  return (
    <ul>
      {changes.map((change) => (
        <li key={change}>{change}</li>
      ))}
    </ul>
  )
}

export function ReleaseNotes() {
  const [open, setOpen] = useState(false)
  return (
    <ExplanationPopover
      label="更新日志"
      closeLabel="关闭更新日志"
      className="release-notes"
      onOpenChange={setOpen}
      focusCloseOnOpen
    >
      {open ? (
        <ol className="release-notes__list">
          {releases.map((release, index) => (
            <li key={release.id} className="release-notes__entry">
              <div className="release-notes__date">
                <time dateTime={release.date}>{release.date}</time>
                {index === 0 ? <span>最新</span> : null}
              </div>
              <h2>{release.title}</h2>
              {'sections' in release ? (
                <>
                  <p>{release.summary}</p>
                  <div className="release-notes__sections">
                    {release.sections.map((section) => (
                      <section key={section.title}>
                        <h3>{section.title}</h3>
                        <ReleaseChanges changes={section.changes} />
                      </section>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="release-notes__date">适用：{release.scope}</p>
                  <ReleaseChanges changes={release.changes} />
                </>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </ExplanationPopover>
  )
}
