import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      // Expose VITE_ prefixed env vars to the client
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
    server: {
      port: 5173,
      host: true,   // Enable access from mobile on local network
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      }
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 3000,
    },
  }
})
