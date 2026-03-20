import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import autoImport from 'unplugin-auto-import/vite'

export default defineConfig({
  plugins: [
    vue(),
    autoImport({ imports: ['vue'] }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
})
