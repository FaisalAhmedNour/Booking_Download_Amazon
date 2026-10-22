import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5555
  },
  base: '',
  build: {
    outDir: '../UI',
    emptyOutDir: true, // also necessary
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          exceljs: ['exceljs'],
        },
      },
    },
    chunkSizeWarningLimit: 5008
  }
})