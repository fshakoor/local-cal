import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'
// load repo-root .env explicitly (the server is launched from the workspace dir)
dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') })

import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { z } from 'zod'
import { createEvent, deleteEvent, eventInput, listEvents, updateEvent } from './events.js'
import { allSettings, setSetting } from './settings.js'
import { buildDigest, sendDigest } from './notify.js'
import { startScheduler } from './schedule.js'

const app = Fastify({ logger: false })

app.get('/api/health', async () => ({ ok: true }))

// ── events ────────────────────────────────────────────────────────────────────
app.get('/api/events', async (req) => {
  const { from, to } = req.query as { from?: string; to?: string }
  return listEvents(from, to)
})

app.post('/api/events', async (req, reply) => {
  const parsed = eventInput.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'invalid' })
  return createEvent(parsed.data)
})

app.put('/api/events/:id', async (req, reply) => {
  const id = Number((req.params as { id: string }).id)
  const parsed = eventInput.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'invalid' })
  const ev = updateEvent(id, parsed.data)
  if (!ev) return reply.code(404).send({ error: 'not found' })
  return ev
})

app.delete('/api/events/:id', async (req, reply) => {
  const id = Number((req.params as { id: string }).id)
  if (!deleteEvent(id)) return reply.code(404).send({ error: 'not found' })
  return { ok: true }
})

// ── settings (digest time / enabled) ───────────────────────────────────────────
app.get('/api/settings', async () => allSettings())

const settingsPatch = z.object({
  digest_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  digest_enabled: z.enum(['0', '1']).optional(),
})
app.patch('/api/settings', async (req, reply) => {
  const parsed = settingsPatch.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: 'invalid' })
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) setSetting(k, v)
  return allSettings()
})

// ── digest: preview (no send) + test (send now) ────────────────────────────────
app.get('/api/digest/preview', async () => buildDigest())

app.post('/api/digest/test', async (_req, reply) => {
  try {
    const status = await sendDigest()
    return { ok: true, status }
  } catch (err) {
    return reply.code(400).send({ ok: false, error: (err as Error).message })
  }
})

app.get('/api/digest/log', async () => {
  try {
    const p = path.resolve(import.meta.dirname, '../data/digest.log')
    const text = fs.readFileSync(p, 'utf8')
    return { lines: text.trimEnd().split('\n').slice(-40) }
  } catch {
    return { lines: [] }
  }
})

// ── serve the built client in production (single-port over Tailscale) ──────────
const distDir = path.resolve(import.meta.dirname, '../../client/dist')
const hasDist = fs.existsSync(path.join(distDir, 'index.html'))
if (hasDist) {
  await app.register(fastifyStatic, { root: distDir })
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' })
    return reply.sendFile('index.html') // SPA fallback
  })
}

const port = Number(process.env.PORT || 5178)
// In prod (serving the client) bind on all interfaces so tailnet devices can reach it.
// In dev the API stays on localhost; the Vite client (host:true) proxies /api to it.
const host = process.env.HOST || (hasDist ? '0.0.0.0' : '127.0.0.1')

app.listen({ port, host }).then(() => {
  const log = (m: string) => console.log(`[my-cal] ${m}`)
  log(`api on http://${host}:${port}${hasDist ? '  (also serving the built client)' : ''}`)
  startScheduler(log)
})
