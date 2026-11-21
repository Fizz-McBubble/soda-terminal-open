import type { RefObject } from 'react'
import { Editor } from './Editors'
import type { AssetGoldenProps, CatalogItem, CatalogKind, DiscItem } from './types'

export function CatalogWorkspaceEditorAside({
  editorRef,
  kindLabel,
  selectedLabel,
  selectedMeta,
  totalRowCount,
  selectedId,
  selected,
  isPagedVisible,
  isFiltered,
  onShowSelectedInList,
  props,
  kind,
}: {
  editorRef: RefObject<HTMLElement | null>
  kindLabel: string
  selectedLabel: string | undefined
  selectedMeta: string | undefined
  totalRowCount: number
  selectedId: string | undefined
  selected: CatalogItem | DiscItem | undefined
  isPagedVisible: boolean
  isFiltered: boolean
  onShowSelectedInList: () => void
  props: AssetGoldenProps
  kind: CatalogKind
}) {
  return (
    <aside ref={editorRef} className="editor" aria-label={`${kindLabel}编辑区`}>
      <div className="asset-editor-context" role="status" aria-live="polite" aria-atomic="true">
        <span>当前选中</span>
        <strong>{selectedLabel ?? '等待选择'}</strong>
        {selectedMeta ? <small>{selectedMeta}</small> : null}
        {!selected && !selectedMeta ? (
          <small>
            {totalRowCount ? '从目录选择一个对象后继续编辑。' : '当前账户暂无可选对象。'}
          </small>
        ) : null}
      </div>
      <div
        className="asset-editor-content"
        data-motion-state-content
        data-selected-id={selectedId || undefined}
      >
        {selected && !isPagedVisible ? (
          <p className="selection-context" role="status">
            仍在查看：{selectedLabel}
            <span>{isFiltered ? '此对象不在当前页。' : '此对象不在当前筛选结果中。'}</span>
            <button className="button button--quiet" type="button" onClick={onShowSelectedInList}>
              在列表中显示
            </button>
          </p>
        ) : null}
        {selected ? (
          <Editor props={props} kind={kind} item={selected} />
        ) : (
          <section className="editor-section">
            <h2>暂无可编辑对象</h2>
            <p>扫描、导入或切换账户后，目录会自动更新。</p>
          </section>
        )}
      </div>
    </aside>
  )
}
