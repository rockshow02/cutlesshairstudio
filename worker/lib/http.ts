import type { Context } from 'hono';
import type { z } from 'zod';
import { badRequest } from './errors';

/** Validasi body JSON / query dengan skema Zod bersama → 400 BAD_REQUEST berisi pesan per field */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const issue of r.error.issues) fields[issue.path.join('.') || '_'] ??= issue.message;
    throw badRequest(Object.values(fields)[0] ?? 'Data tidak valid.', { fields });
  }
  return r.data;
}

export async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw badRequest('Body harus JSON.');
  }
  return parse(schema, json);
}

export const query = <S extends z.ZodType>(c: Context, schema: S): z.output<S> => parse(schema, c.req.query());

/** Jalankan di latar (waitUntil) bila ada ExecutionContext; tanpa itu (tes) ditunggu langsung */
export async function defer(c: Context, task: Promise<unknown>): Promise<void> {
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    await task;
  }
}
