import { apiClient } from './client'

export async function register({ email, password, displayName }) {
  const { data } = await apiClient.post('/auth/register', {
    email,
    password,
    display_name: displayName,
  })
  return data
}

export async function login({ email, password }) {
  // 백엔드가 OAuth2 폼 형식을 받으므로 form-urlencoded로 전송한다.
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  const { data } = await apiClient.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export async function fetchMe() {
  const { data } = await apiClient.get('/auth/me')
  return data
}
