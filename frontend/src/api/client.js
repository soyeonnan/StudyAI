import axios from 'axios'

// API 기본 주소. 환경변수 VITE_API_BASE_URL이 있으면 사용하고, 없으면 프록시(/api)를 탄다.
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

const TOKEN_KEY = 'study_calendar_token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const apiClient = axios.create({ baseURL })

// 요청마다 저장된 토큰을 Authorization 헤더에 자동 첨부한다.
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 응답이면 토큰을 비우고 로그인 화면으로 유도한다.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.clear()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
