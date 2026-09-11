import { useEffect, useState } from 'react'

import { createSubject, deleteSubject, fetchSubjectTree } from '../../api/subjects'
import './SubjectManager.css'

/**
 * 과목 관리: 대분류/소분류 추가·삭제.
 * onChanged 콜백으로 과목 변경을 상위에 알려 다른 컴포넌트가 갱신하게 한다.
 */
export default function SubjectManager({ onChanged }) {
  const [tree, setTree] = useState([])
  const [newParentName, setNewParentName] = useState('')
  const [childInputs, setChildInputs] = useState({}) // { [parentId]: '입력값' }

  async function reload() {
    const data = await fetchSubjectTree()
    setTree(data)
  }

  useEffect(() => {
    reload()
  }, [])

  function notify() {
    reload()
    if (onChanged) onChanged()
  }

  async function handleAddParent(e) {
    e.preventDefault()
    const name = newParentName.trim()
    if (!name) return
    await createSubject({ name })
    setNewParentName('')
    notify()
  }

  async function handleAddChild(parentId) {
    const name = (childInputs[parentId] || '').trim()
    if (!name) return
    await createSubject({ name, parentId })
    setChildInputs((prev) => ({ ...prev, [parentId]: '' }))
    notify()
  }

  async function handleDelete(subjectId) {
    await deleteSubject(subjectId)
    notify()
  }

  return (
    <div className="subject-manager">
      <form className="subject-add-parent" onSubmit={handleAddParent}>
        <input
          className="field"
          placeholder="대분류 추가 (예: 영어)"
          value={newParentName}
          onChange={(e) => setNewParentName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">추가</button>
      </form>

      <ul className="subject-tree">
        {tree.length === 0 && <li className="subject-empty">등록된 과목이 없어요.</li>}
        {tree.map((parent) => (
          <li key={parent.id} className="subject-parent">
            <div className="subject-parent-head">
              <span className="subject-parent-name">{parent.name}</span>
              <button className="btn btn-danger" onClick={() => handleDelete(parent.id)}>삭제</button>
            </div>

            <ul className="subject-children">
              {parent.children.map((child) => (
                <li key={child.id} className="subject-child">
                  <span>{child.name}</span>
                  <button className="btn btn-danger" onClick={() => handleDelete(child.id)}>삭제</button>
                </li>
              ))}
            </ul>

            <div className="subject-add-child">
              <input
                className="field"
                placeholder="소분류 추가 (예: 영어단어)"
                value={childInputs[parent.id] || ''}
                onChange={(e) =>
                  setChildInputs((prev) => ({ ...prev, [parent.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddChild(parent.id)
                  }
                }}
              />
              <button className="btn" onClick={() => handleAddChild(parent.id)}>추가</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
