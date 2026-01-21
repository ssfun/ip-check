import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 生产环境移除控制台日志
    minify: 'esbuild',
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心库
          'vendor-react': ['react', 'react-dom'],
          // 图表库
          'vendor-chart': ['chart.js', 'react-chartjs-2'],
          // Markdown 渲染
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },
  esbuild: {
    // 生产环境下移除 console 和 debugger
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      }
    }
  }
}))