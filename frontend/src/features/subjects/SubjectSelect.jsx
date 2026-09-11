import { useEffect, useState } from 'react'

import { fetchSubjectTree } from '../../api/subjects'

/**
 * 과목 선택 드롭다운 (대분류 > 소분류 계층).
 * 타이머와 루틴에서 공통으로 사용해 동일한 과목 소스를 참조한다.
 *
 * props:
 * - value: 선택된 subject_id (number | '' )
 * - onChange: (subjectId | null) => void
 * - allowEmpty: 빈 값(선택 안 함) 허용 여부
 * - reloadKey: 값이 바뀌면 과목 목록을 다시 불러온다 (과목 추가 후 갱신용)
 */
export default function SubjectSelect({ value, onChange, allowEmpty = false, reloadKey }) {
  const [tree, setTree] = useState([])

  useEffect(() => {
    fetchSubjectTree().then(setTree)
  }, [reloadKey])

  return (
    <select
      className="field"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? null : Number(v))
      }}
    >
      {allowEmpty && <option value="">과목 없음</option>}
      {tree.length === 0 && !allowEmpty && <option value="">과목을 먼저 추가하세요</option>}
      {tree.map((parent) => {
        // 소분류가 있으면 optgroup으로 묶고, 없으면 대분류 자체를 선택 가능하게 한다.
        if (parent.children.length > 0) {
          return (
            <optgroup key={parent.id} label={parent.name}>
              <option value={parent.id}>{parent.name} (전체)</option>
              {parent.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {parent.name} &gt; {child.name}
                </option>
              ))}
            </optgroup>
          )
        }
        return (
          <option key={parent.id} value={parent.id}>
            {parent.name}
          </option>
        )
      })}
    </select>
  )
}
