import { useEffect, useState } from 'react'

import { fetchGuides } from '../api/admin'
import './GuidesPage.css'

export default function GuidesPage() {
  const [guides, setGuides] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchGuides()
      .then((data) => {
        setGuides(data)
        if (data.length > 0) setActiveId(data[0].id)
      })
      .catch(() => setError('가이드를 불러올 수 없습니다.'))
  }, [])

  const active = guides.find((g) => g.id === activeId)

  return (
    <div className="guides">
      <h2 className="page-title">학습 가이드 <span className="guides-admin-badge">관리자</span></h2>
      {error && <p className="error-text">{error}</p>}

      <div className="guides-layout">
        {/* 카테고리 목록 */}
        <aside className="guides-nav">
          {guides.map((g) => (
            <button
              key={g.id}
              className={`guides-nav-item ${g.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(g.id)}
            >
              {g.title}
            </button>
          ))}
        </aside>

        {/* 선택된 가이드 내용 */}
        <div className="guides-content card">
          {active && (
            <>
              <h3 className="guides-title">{active.title}</h3>
              <p className="guides-summary">{active.summary}</p>
              {active.sections.map((section) => (
                <div key={section.heading} className="guides-section">
                  <h4 className="guides-heading">{section.heading}</h4>
                  <pre className="guides-body">{section.body}</pre>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
