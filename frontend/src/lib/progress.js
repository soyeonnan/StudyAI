// 진행률(0~100)에 따른 색상과 라벨을 결정하는 유틸.
// 루틴/일정 진행률, 대시보드 등 여러 곳에서 재사용한다.

// 완료 개수/전체 개수로 퍼센트를 계산한다. 전체가 0이면 0%.
export function toPercent(done, total) {
  if (!total || total <= 0) return 0
  return Math.round((done / total) * 100)
}

// 진행률 구간별 색상. (CSS 변수 대신 실제 색상값을 반환해 인라인 스타일에 쓴다.)
export function progressColor(percent) {
  if (percent >= 100) return '#10b981' // 완료: 초록
  if (percent >= 70) return '#22c55e' // 높음: 연초록
  if (percent >= 40) return '#f59e0b' // 중간: 주황
  if (percent > 0) return '#ef4444' // 낮음: 빨강
  return '#cbd5e1' // 시작 전: 회색
}

// 진행률 구간별 한글 라벨.
export function progressLabel(percent) {
  if (percent >= 100) return '완료'
  if (percent >= 70) return '거의 다 됐어요'
  if (percent >= 40) return '진행 중'
  if (percent > 0) return '시작했어요'
  return '아직 시작 전'
}
