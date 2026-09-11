import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 중 백엔드 API 프록시 설정. 환경변수 VITE_API_TARGET로 대상 변경 가능.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
