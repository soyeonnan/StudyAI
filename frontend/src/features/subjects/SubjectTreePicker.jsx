import { useEffect, useMemo, useState } from 'react'

import { fetchSubjectTree } from '../../api/subjects'
import './SubjectTreePicker.css'

// 트리를 평면 목록으로 펼치면서 각 노드의 전체 경로(예: "CS > network > TCP-IP")를 만든다.
function flatten(nodes, parentPath, acc) {
  for (const node of nodes) {
    const path = parentPath ? `${parentPath} > ${node.name}` : node.name
    acc.push({ id: node.id, name: node.name, depth: node.depth, path, hasChildren: node.children.length > 0 })
    if (node.children.length > 0) flatten(node.children, path, acc)
  }
  return acc
}

/**
 * 무제한 depth 과목 선택기 (검색 + 펼치기/접기 트리).
 * 하위가 많아져도 검색으로 빠르게 찾고, 트리로 탐색할 수 있다.
 *
 * props:
 * - value: 선택된 subject_id (number | null)
 * - onChange: (subjectId | null) => void
 * - reloadKey: 값 변경 시 목록 갱신
 * - allowEmpty: '선택 안 함' 허용
 */
export default function SubjectTreePicker({ value, onChange, reloadKey, allowEmpty = false }) {
  const [tree, setTree] = useState([])
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchSubjectTree().then(setTree)
  }, [reloadKey])

  const flat = useMemo(() => flatten(tree, '', []), [tree])
  const selected = flat.find((n) => n.id === value)

  // 검색 결과(경로 기준 부분 일치). 검색 중엔 트리 대신 평면 결과를 보여준다.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return flat.filter((n) => n.path.toLowerCase().includes(q))
  }, [query, flat])

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function pick(id) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  // 트리 렌더 (재귀)
  function renderNodes(nodes) {
    return nodes.map((node) => {
      const isExpanded = expanded.has(node.id)
      const hasChildren = node.children.length > 0
      return (
        <div key={node.id}>
          <div className="tp-row" style={{ paddingLeft: `${node.depth * 16 + 8}px` }}>
            {hasChildren ? (
              <button type="button" className="tp-toggle" onClick={() => toggleExpand(node.id)}>
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="tp-toggle-placeholder" />
            )}
            <button
              type="button"
              className={`tp-name ${node.id === value ? 'tp-selected' : ''}`}
              onClick={() => pick(node.id)}
            >
              {node.name}
            </button>
          </div>
          {hasChildren && isExpanded && renderNodes(node.children)}
        </div>
      )
    })
  }

  return (
    <div className="tree-picker">
      <button type="button" className="field tp-trigger" onClick={() => setOpen((v) => !v)}>
        {selected ? selected.path : '과목 선택'}
        <span className="tp-caret">▾</span>
      </button>

      {open && (
        <div className="tp-panel">
          <input
            className="field tp-search"
            placeholder="과목 검색 (예: TCP)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          <div className="tp-list">
            {allowEmpty && !query && (
              <div className="tp-row" style={{ paddingLeft: 8 }}>
                <span className="tp-toggle-placeholder" />
                <button type="button" className="tp-name" onClick={() => pick(null)}>
                  선택 안 함
                </button>
              </div>
            )}

            {/* 검색 중이면 경로 기반 평면 결과, 아니면 트리 */}
            {searchResults ? (
              searchResults.length > 0 ? (
                searchResults.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`tp-search-item ${n.id === value ? 'tp-selected' : ''}`}
                    onClick={() => pick(n.id)}
                  >
                    {n.path}
                  </button>
                ))
              ) : (
                <p className="tp-empty">검색 결과가 없어요.</p>
              )
            ) : tree.length > 0 ? (
              renderNodes(tree)
            ) : (
              <p className="tp-empty">등록된 과목이 없어요. 과목 관리에서 추가하세요.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
