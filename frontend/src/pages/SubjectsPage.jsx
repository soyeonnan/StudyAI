import { useNavigate } from 'react-router-dom'

import SubjectManager from '../features/subjects/SubjectManager'
import './SubjectsPage.css'

/**
 * 과목 관리 페이지.
 * 무제한 depth로 과목을 추가/삭제하고, 특정 과목을 골라 바로 타이머를 시작할 수 있다.
 * 타이머로 넘길 때는 라우터 state로 과목 id를 전달한다.
 */
export default function SubjectsPage() {
  const navigate = useNavigate()

  function handlePickToTimer(subjectId, path) {
    // 선택한 과목을 들고 타이머 페이지로 이동
    navigate('/timer', { state: { subjectId, subjectPath: path } })
  }

  return (
    <div className="subjects-page">
      <h2 className="page-title">과목 관리</h2>
      <p className="subjects-desc">
        대분류부터 원하는 만큼 하위 과목을 만들 수 있어요. 각 과목의 &quot;타이머 시작&quot;을 누르면
        그 과목으로 바로 타이머를 시작합니다.
      </p>

      <div className="card subjects-card">
        <SubjectManager onPick={handlePickToTimer} pickLabel="타이머 시작" />
      </div>
    </div>
  )
}
