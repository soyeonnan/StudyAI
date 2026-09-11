import { useState } from 'react'

import { createSession } from '../api/sessions'
import SubjectManager from '../features/subjects/SubjectManager'
import SubjectTreePicker from '../features/subjects/SubjectTreePicker'
import { TimerStatus, useStudyTimer } from '../features/timer/useStudyTimer'
import { formatClock, formatDuration } from '../lib/time'
import './TimerPage.css'

const FOCUS_LABELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음']

export default function TimerPage() {
  const timer = useStudyTimer()
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [subjectReloadKey, setSubjectReloadKey] = useState(0)
  const [showSubjectManager, setShowSubjectManager] = useState(false)

  // 종료 후 입력받는 정리 정보
  const [focusLevel, setFocusLevel] = useState(3)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSave() {
    if (!selectedSubjectId || !timer.startedAt) return
    setSaving(true)
    setMessage('')
    try {
      await createSession({
        subject_id: Number(selectedSubjectId),
        started_at: timer.startedAt.toISOString(),
        ended_at: new Date().toISOString(),
        study_seconds: timer.studySeconds,
        break_seconds: timer.breakSeconds,
        focus_level: focusLevel,
        memo: memo.trim() || null,
      })
      setMessage('공부 기록이 저장되었어요!')
      setMemo('')
      setFocusLevel(3)
      timer.reset()
    } catch {
      setMessage('저장에 실패했어요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const isRunning = timer.status === TimerStatus.STUDYING || timer.status === TimerStatus.PAUSED
  const isStopped = timer.status === TimerStatus.STOPPED

  return (
    <div className="timer-page">
      <h2 className="page-title">공부 타이머</h2>

      <div className="card timer-card">
        {/* 과목 선택 (공부 캘린더와 동일한 과목 소스 사용) */}
        <div className="timer-subject">
          <div className="timer-subject-head">
            <label className="form-label">공부 과목</label>
            {!isRunning && !isStopped && (
              <button
                type="button"
                className="btn timer-subject-toggle"
                onClick={() => setShowSubjectManager((v) => !v)}
              >
                {showSubjectManager ? '닫기' : '과목 관리'}
              </button>
            )}
          </div>

          <SubjectTreePicker
            value={selectedSubjectId}
            onChange={setSelectedSubjectId}
            reloadKey={subjectReloadKey}
          />

          {showSubjectManager && !isRunning && !isStopped && (
            <div className="timer-subject-manager">
              <SubjectManager onChanged={() => setSubjectReloadKey((k) => k + 1)} />
            </div>
          )}
        </div>

        {/* 타이머 표시 */}
        <div className={`timer-display ${timer.status === TimerStatus.PAUSED ? 'is-break' : ''}`}>
          <div className="timer-clock">{formatClock(timer.studySeconds)}</div>
          <div className="timer-status-badge">
            {timer.status === TimerStatus.STUDYING && '공부 중'}
            {timer.status === TimerStatus.PAUSED && '휴식 중'}
            {timer.status === TimerStatus.IDLE && '대기 중'}
            {timer.status === TimerStatus.STOPPED && '완료'}
          </div>
          <div className="timer-break">휴식 시간 {formatDuration(timer.breakSeconds)}</div>
        </div>

        {/* 컨트롤 버튼 */}
        <div className="timer-controls">
          {timer.status === TimerStatus.IDLE && (
            <button className="btn btn-primary timer-btn" onClick={timer.start} disabled={!selectedSubjectId}>
              시작
            </button>
          )}
          {timer.status === TimerStatus.STUDYING && (
            <>
              <button className="btn timer-btn" onClick={timer.pause}>일시정지 (휴식)</button>
              <button className="btn btn-primary timer-btn" onClick={timer.stop}>중지 (종료)</button>
            </>
          )}
          {timer.status === TimerStatus.PAUSED && (
            <>
              <button className="btn btn-primary timer-btn" onClick={timer.resume}>공부 재개</button>
              <button className="btn timer-btn" onClick={timer.stop}>중지 (종료)</button>
            </>
          )}
        </div>
      </div>

      {/* 종료 후 정리 입력 */}
      {isStopped && (
        <div className="card timer-summary">
          <h3 className="timer-summary-title">공부 정리</h3>
          <div className="timer-summary-stats">
            <div>
              <span className="stat-label">총 공부 시간</span>
              <strong>{formatDuration(timer.studySeconds)}</strong>
            </div>
            <div>
              <span className="stat-label">총 휴식 시간</span>
              <strong>{formatDuration(timer.breakSeconds)}</strong>
            </div>
          </div>

          <label className="form-label">집중도</label>
          <div className="focus-selector">
            {FOCUS_LABELS.map((label, idx) => {
              const level = idx + 1
              return (
                <button
                  key={level}
                  className={`focus-btn ${focusLevel === level ? 'focus-btn-active' : ''}`}
                  onClick={() => setFocusLevel(level)}
                  type="button"
                >
                  <span className="focus-num">{level}</span>
                  <span className="focus-label">{label}</span>
                </button>
              )
            })}
          </div>

          <label className="form-label" htmlFor="memo">간단 메모</label>
          <textarea
            id="memo"
            className="field timer-memo"
            rows={3}
            placeholder="오늘 공부한 내용을 간단히 정리해보세요"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />

          <div className="timer-summary-actions">
            <button className="btn" onClick={timer.reset} disabled={saving}>취소</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '기록 저장'}
            </button>
          </div>
        </div>
      )}

      {message && <p className="timer-message">{message}</p>}
    </div>
  )
}
