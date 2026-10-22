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
    // localhost only: binding all interfaces also exposed this to the LAN. Reach it from the tailnet
    // (e.g. your phone) through `tailscale serve`, which proxies to this port.
    host: '127.0.0.1',
    allowedHosts: ['.ts.net'], // accept the Tailscale MagicDNS hostname (raw 100.x IPs are allowed by default)
    proxy: {
      '/api': process.env.CAL_API_URL || 'http://localhost:5178',
    },
  },
})
