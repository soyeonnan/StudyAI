import { useEffect, useState } from 'react'

import { createSubject, deleteSubject, fetchSubjectTree } from '../../api/subjects'
import './SubjectManager.css'

/**
 * 무제한 depth 과목 관리: 각 노드에 하위 추가·삭제. 선택 시 콜백(예: 타이머 바로가기).
 *
 * props:
 * - onChanged: 과목 변경 시 상위에 알림
 * - onPick: (subjectId, path) => void  (선택 액션이 있을 때만; 없으면 선택 버튼 숨김)
 * - pickLabel: 선택 버튼 라벨 (기본 "선택")
 */
export default function SubjectManager({ onChanged, onPick, pickLabel = '선택' }) {
  const [tree, setTree] = useState([])
  const [rootName, setRootName] = useState('')
  const [childInputs, setChildInputs] = useState({}) // { [parentId]: '입력값' }
  const [addingFor, setAddingFor] = useState(null) // 하위 추가 입력창을 연 노드 id

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
    notify()
  }

  async function handleDelete(subjectId) {
    await deleteSubject(subjectId)
    notify()
  }

  // 트리 노드 재귀 렌더
  function renderNode(node, path) {
    const nodePath = path ? `${path} > ${node.name}` : node.name
    return (
      <li key={node.id} className="sm-node">
        <div className="sm-row" style={{ paddingLeft: `${node.depth * 18}px` }}>
          <span className="sm-name">{node.name}</span>
          <div className="sm-actions">
            {onPick && (
              <button className="btn sm-mini" onClick={() => onPick(node.id, nodePath)}>
                {pickLabel}
              </button>
            )}
            <button
              className="btn sm-mini"
              onClick={() => setAddingFor(addingFor === node.id ? null : node.id)}
            >
              하위 추가
            </button>
            <button className="btn btn-danger sm-mini" onClick={() => handleDelete(node.id)}>
              삭제
            </button>
          </div>
        </div>

        {addingFor === node.id && (
          <div className="sm-add-child" style={{ paddingLeft: `${(node.depth + 1) * 18}px` }}>
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
          </div>
        )}

        {node.children.length > 0 && (
          <ul className="sm-children">
            {node.children.map((child) => renderNode(child, nodePath))}
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
        <button type="submit" className="btn btn-primary">추가</button>
      </form>

      <ul className="subject-tree">
        {tree.length === 0 && <li className="subject-empty">등록된 과목이 없어요.</li>}
        {tree.map((node) => renderNode(node, ''))}
      </ul>
    </div>
  )
}
