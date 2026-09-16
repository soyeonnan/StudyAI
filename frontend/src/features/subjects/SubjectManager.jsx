import { useEffect, useState } from 'react'

import { createSubject, deleteSubject, fetchSubjectTree } from '../../api/subjects'
import { useConfirm } from '../../components/ConfirmProvider'
import './SubjectManager.css'

/**
 * 무제한 depth 과목 관리 (아코디언 방식).
 * - 대분류는 가로로 카드처럼 나열되고, 클릭하면 그 아래 하위 트리가 펼쳐진다.
 * - 하위 노드도 자식이 있으면 접기/펼치기 가능. 각 노드에서 하위 추가·삭제.
 *
 * props:
 * - onChanged: 과목 변경 시 상위에 알림
 * - onPick: (subjectId, path) => void  (선택 액션; 없으면 선택 버튼 숨김)
 * - pickLabel: 선택 버튼 라벨 (기본 "선택")
 */
export default function SubjectManager({ onChanged, onPick, pickLabel = '선택' }) {
  const confirm = useConfirm()
  const [tree, setTree] = useState([])
  const [rootName, setRootName] = useState('')
  const [childInputs, setChildInputs] = useState({}) // { [parentId]: '입력값' }
  const [addingFor, setAddingFor] = useState(null) // 하위 추가 입력창을 연 노드 id
  const [expanded, setExpanded] = useState(() => new Set()) // 펼쳐진 노드 id

  async function reload() {
    setTree(await fetchSubjectTree())
  }

  useEffect(() => {
    reload()
  }, [])

  function notify() {
    reload()
    if (onChanged) onChanged()
  }

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAddRoot(e) {
    e.preventDefault()
    const name = rootName.trim()
    if (!name) return
    await createSubject({ name })
    setRootName('')
    notify()
  }

  async function handleAddChild(parentId) {
    const name = (childInputs[parentId] || '').trim()
    if (!name) return
    await createSubject({ name, parentId })
    setChildInputs((prev) => ({ ...prev, [parentId]: '' }))
    setAddingFor(null)
    setExpanded((prev) => new Set(prev).add(parentId)) // 추가하면 그 노드를 펼쳐 보여준다
    notify()
  }

  async function handleDelete(node) {
    const ok = await confirm({
      title: '과목 삭제',
      message: node.children.length > 0
        ? `"${node.name}"과 그 하위 과목이 모두 삭제됩니다. 계속할까요?`
        : `"${node.name}" 과목을 삭제할까요?`,
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    await deleteSubject(node.id)
    notify()
  }

  // 하위 추가 입력창 (공용)
  function renderAddChild(node) {
    if (addingFor !== node.id) return null
    return (
      <div className="sm-add-child">
        <input
          className="field"
          placeholder={`'${node.name}' 하위 과목 이름`}
          value={childInputs[node.id] || ''}
          onChange={(e) => setChildInputs((prev) => ({ ...prev, [node.id]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddChild(node.id)
            }
          }}
          autoFocus
        />
        <button className="btn btn-primary sm-mini" onClick={() => handleAddChild(node.id)}>추가</button>
        <button className="btn sm-mini" onClick={() => setAddingFor(null)}>취소</button>
      </div>
    )
  }

  // 자식 노드(2depth 이하) 재귀 렌더 — 세로 트리
  function renderChildNode(node, path) {
    const nodePath = path ? `${path} > ${node.name}` : node.name
    const hasChildren = node.children.length > 0
    const isOpen = expanded.has(node.id)
    return (
      <li key={node.id} className="sm-node">
        <div className="sm-row">
          {hasChildren ? (
            <button type="button" className="sm-toggle" onClick={() => toggleExpand(node.id)}>
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="sm-toggle-placeholder" />
          )}
          <span className="sm-name" onClick={() => hasChildren && toggleExpand(node.id)}>
            {node.name}
          </span>
          <div className="sm-actions">
            {onPick && (
              <button className="btn sm-mini" onClick={() => onPick(node.id, nodePath)}>{pickLabel}</button>
            )}
            <button className="btn sm-mini" onClick={() => setAddingFor(addingFor === node.id ? null : node.id)}>+ 하위</button>
            <button className="btn btn-danger sm-mini" onClick={() => handleDelete(node)}>삭제</button>
          </div>
        </div>

        {renderAddChild(node)}

        {hasChildren && isOpen && (
          <ul className="sm-children">
            {node.children.map((child) => renderChildNode(child, nodePath))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="subject-manager">
      <form className="subject-add-parent" onSubmit={handleAddRoot}>
        <input
          className="field"
          placeholder="대분류 추가 (예: 영어)"
          value={rootName}
          onChange={(e) => setRootName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">대분류 추가</button>
      </form>

      {tree.length === 0 ? (
        <p className="subject-empty">등록된 과목이 없어요. 대분류부터 추가해 보세요.</p>
      ) : (
        // 대분류: 가로로 나열되는 카드. 클릭하면 아래로 하위 트리가 펼쳐진다.
        <div className="sm-root-grid">
          {tree.map((root) => {
            const isOpen = expanded.has(root.id)
            const hasChildren = root.children.length > 0
            return (
              <div key={root.id} className={`sm-root-card ${isOpen ? 'sm-root-open' : ''}`}>
                <div className="sm-root-head">
                  <button
                    type="button"
                    className="sm-root-btn"
                    onClick={() => toggleExpand(root.id)}
                  >
                    <span className="sm-root-caret">{hasChildren ? (isOpen ? '▾' : '▸') : '·'}</span>
                    <span className="sm-root-name">{root.name}</span>
                    {hasChildren && <span className="sm-root-count">{root.children.length}</span>}
                  </button>
                </div>

                <div className="sm-root-actions">
                  {onPick && (
                    <button className="btn sm-mini" onClick={() => onPick(root.id, root.name)}>{pickLabel}</button>
                  )}
                  <button className="btn sm-mini" onClick={() => setAddingFor(addingFor === root.id ? null : root.id)}>+ 하위</button>
                  <button className="btn btn-danger sm-mini" onClick={() => handleDelete(root)}>삭제</button>
                </div>

                {renderAddChild(root)}

                {isOpen && hasChildren && (
                  <ul className="sm-children sm-children-root">
                    {root.children.map((child) => renderChildNode(child, root.name))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
