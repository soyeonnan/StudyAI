import { useCallback, useEffect, useRef, useState } from 'react'

// 타이머 상태: idle(대기) -> studying(공부중) <-> paused(휴식중) -> stopped(종료)
export const TimerStatus = {
  IDLE: 'idle',
  STUDYING: 'studying',
  PAUSED: 'paused',
  STOPPED: 'stopped',
}

/**
 * 공부 타이머 훅.
 * - 시작: 공부 시작(startedAt 기록)
 * - 일시정지: 휴식 시작 (공부 시간 누적 멈춤, 휴식 시간 누적 시작)
 * - 재개: 다시 공부
 * - 중지: 종료 (누적된 공부/휴식 시간 확정)
 *
 * 실제 경과는 벽시계(Date.now)로 계산해 브라우저 타이머 드리프트를 방지한다.
 */
export function useStudyTimer() {
  const [status, setStatus] = useState(TimerStatus.IDLE)
  const [studySeconds, setStudySeconds] = useState(0)
  const [breakSeconds, setBreakSeconds] = useState(0)

  const startedAtRef = useRef(null) // 최초 시작 시각 (Date)
  const phaseStartRef = useRef(null) // 현재 구간 시작 시각(ms)
  const accStudyRef = useRef(0) // 확정된 공부 시간(초)
  const accBreakRef = useRef(0) // 확정된 휴식 시간(초)
  const intervalRef = useRef(null)

  const tick = useCallback(() => {
    if (phaseStartRef.current === null) return
    const elapsed = (Date.now() - phaseStartRef.current) / 1000
    setStudySeconds(accStudyRef.current + (statusRef.current === TimerStatus.STUDYING ? elapsed : 0))
    setBreakSeconds(accBreakRef.current + (statusRef.current === TimerStatus.PAUSED ? elapsed : 0))
  }, [])

  // status를 ref로도 추적해 setInterval 콜백에서 최신 값을 참조한다.
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (status === TimerStatus.STUDYING || status === TimerStatus.PAUSED) {
      intervalRef.current = setInterval(tick, 250)
      return () => clearInterval(intervalRef.current)
    }
    return undefined
  }, [status, tick])

  const start = useCallback(() => {
    const now = Date.now()
    startedAtRef.current = new Date(now)
    phaseStartRef.current = now
    accStudyRef.current = 0
    accBreakRef.current = 0
    setStudySeconds(0)
    setBreakSeconds(0)
    setStatus(TimerStatus.STUDYING)
  }, [])

  const pause = useCallback(() => {
    // 공부 구간 확정 후 휴식 구간 시작
    const elapsed = (Date.now() - phaseStartRef.current) / 1000
    accStudyRef.current += elapsed
    phaseStartRef.current = Date.now()
    setStatus(TimerStatus.PAUSED)
  }, [])

  const resume = useCallback(() => {
    // 휴식 구간 확정 후 공부 구간 재개
    const elapsed = (Date.now() - phaseStartRef.current) / 1000
    accBreakRef.current += elapsed
    phaseStartRef.current = Date.now()
    setStatus(TimerStatus.STUDYING)
  }, [])

  const stop = useCallback(() => {
    // 현재 구간을 확정하고 종료
    const elapsed = (Date.now() - phaseStartRef.current) / 1000
    if (statusRef.current === TimerStatus.STUDYING) {
      accStudyRef.current += elapsed
    } else if (statusRef.current === TimerStatus.PAUSED) {
      accBreakRef.current += elapsed
    }
    phaseStartRef.current = null
    setStudySeconds(accStudyRef.current)
    setBreakSeconds(accBreakRef.current)
    setStatus(TimerStatus.STOPPED)
  }, [])

  const reset = useCallback(() => {
    clearInterval(intervalRef.current)
    startedAtRef.current = null
    phaseStartRef.current = null
    accStudyRef.current = 0
    accBreakRef.current = 0
    setStudySeconds(0)
    setBreakSeconds(0)
    setStatus(TimerStatus.IDLE)
  }, [])

  return {
    status,
    studySeconds: Math.floor(studySeconds),
    breakSeconds: Math.floor(breakSeconds),
    startedAt: startedAtRef.current,
    start,
    pause,
    resume,
    stop,
    reset,
  }
}
