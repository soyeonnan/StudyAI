import { createContext, useCallback, useContext, useRef, useState } from 'react'

import './ConfirmProvider.css'

const ConfirmContext = createContext(null)

/**
 * 전역 확인 다이얼로그.
 * 어디서든 const confirm = useConfirm(); await confirm({ ... }) 로 사용한다.
 * 확인이면 true, 취소면 false를 반환한다.
 *
 * 프로젝트 규칙: 모든 수정/삭제 등 되돌리기 어려운 동작 전에 이 확인을 거친다.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((options) => {
    setState({
      title: options.title || '확인',
      message: options.message || '',
      confirmText: options.confirmText || '확인',
      cancelText: options.cancelText || '취소',
      danger: options.danger ?? false,
    })
    return new Promise((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const close = useCallback((result) => {
    setState(null)
    if (resolverRef.current) {
      resolverRef.current(result)
      resolverRef.current = null
    }
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-overlay" onClick={() => close(false)}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-title">{state.title}</h3>
            {state.message && <p className="confirm-message">{state.message}</p>}
            <div className="confirm-actions">
              <button className="btn" onClick={() => close(false)}>
                {state.cancelText}
              </button>
              <button
                className={`btn ${state.danger ? 'btn-danger-solid' : 'btn-primary'}`}
                onClick={() => close(true)}
                autoFocus
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm은 ConfirmProvider 내부에서만 사용할 수 있습니다.')
  }
  return ctx
}
