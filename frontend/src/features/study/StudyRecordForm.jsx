import { useState } from 'react'

import SubjectTreePicker from '../subjects/SubjectTreePicker'
import './StudyRecordForm.css'

const FOCUS_LABELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음']

/**
 * 공부 기록 추가/편집 폼.
 * - mode: 'create' | 'edit'
 * - initial: 편집 시 기존 값 { subject_id, study_minutes, break_minutes, focus_level, memo }
 * - date: 대상 날짜 문자열 (create 시 started_at 계산에 사용)
 * - onSubmit: (payload) => Promise
 * - onCancel: () => void
 *
 * 시간은 사용자 친화적으로 '분' 단위로 입력받고, 상위에서 초로 변환한다.
 */
export default function StudyRecordForm({ mode, initial = {}, onSubmit, onCancel }) {
  const [subjectId, setSubjectId] = useState(initial.subject_id ?? null)
  const [studyMinutes, setStudyMinutes] = useState(initial.study_minutes ?? 30)
  const [breakMinutes, setBreakMinutes] = useState(initial.break_minutes ?? 0)
  const [focusLevel, setFocusLevel] = useState(initial.focus_level ?? 3)
  const [memo, setMemo] = useState(initial.memo ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!subjectId) {
      setError('과목을 선택해주세요.')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        subjectId,
        studySeconds: Math.round(Number(studyMinutes) * 60),
        breakSeconds: Math.round(Number(breakMinutes) * 60),
        focusLevel,
        memo: memo.trim(),
      })
    } catch {
      setError('저장에 실패했어요. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div>
        <label className="form-label">과목</label>
        <SubjectTreePicker value={subjectId} onChange={setSubjectId} />
      </div>

      <div className="record-form-row">
        <div>
          <label className="form-label">공부 시간(분)</label>
          <input
            type="number"
            min="0"
            className="field"
            value={studyMinutes}
            onChange={(e) => setStudyMinutes(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">휴식 시간(분)</label>
          <input
            type="number"
            min="0"
            className="field"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="form-label">집중도</label>
        <div className="record-focus">
          {FOCUS_LABELS.map((label, idx) => {
            const level = idx + 1
            return (
              <button
                key={level}
                type="button"
                className={`record-focus-btn ${focusLevel === level ? 'active' : ''}`}
                onClick={() => setFocusLevel(level)}
              >
                {level}
              </button>
            )
          })}
          <span className="record-focus-label">{FOCUS_LABELS[focusLevel - 1]}</span>
        </div>
      </div>

      <div>
        <label className="form-label">메모</label>
        <textarea
          className="field"
          rows={2}
          placeholder="공부 내용을 간단히 정리해보세요"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="record-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>취소</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '저장 중...' : mode === 'edit' ? '수정' : '추가'}
        </button>
      </div>
    </form>
  )
}
