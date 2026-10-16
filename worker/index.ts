import { Hono } from 'hono';
import type { Env } from './env';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM branches').first<{ n: number }>();
  return c.json({ ok: true, env: c.env.APP_ENV, branches: row?.n ?? 0 });
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
