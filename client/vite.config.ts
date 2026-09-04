import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5177,
    strictPort: true,
    // bind on all interfaces so Tailscale (and same-Wi-Fi) devices like your phone can reach it.
    // Only your tailnet devices can hit the 100.x address; the API stays on localhost (Vite proxies to it).
    host: true,
    allowedHosts: ['.ts.net'], // accept the Tailscale MagicDNS hostname (raw 100.x IPs are allowed by default)
    proxy: {
      '/api': process.env.CAL_API_URL || 'http://localhost:5178',
    },
  },
})
