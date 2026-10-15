/**
 * Plugin Vite untuk konten Pages CMS:
 * 1. Validasi src/content/*.json dengan skema Zod saat build (dan saat dev server start / file berubah).
 *    JSON tidak valid → build GAGAL dengan pesan jelas, sehingga salah input admin tidak pernah tayang.
 * 2. Memastikan setiap gambar yang dirujuk konten benar-benar ada di public/.
 * 3. Modul virtual `virtual:image-meta`: lebar & tinggi asli tiap gambar di public/uploads
 *    (mencegah layout shift dan menentukan layout galeri tegak/lebar otomatis).
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import type { Plugin, ViteDevServer } from 'vite';
import { CONTENT_FILES } from '../src/content/schema';

const VIRTUAL_ID = 'virtual:image-meta';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const IMAGE_KEYS = new Set(['photo', 'image', 'logo']);

/** Kumpulkan semua path gambar (/uploads/...) yang dirujuk sebuah file konten */
function collectImages(value: unknown, at: string, out: { path: string; at: string }[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      const entry = v as Record<string, unknown> | null;
      const label = entry?.name ?? entry?.title ?? entry?.altText;
      collectImages(v, `${at}: entri #${i + 1}${label ? ` ("${String(label).slice(0, 40)}")` : ''}`, out);
    });
  }
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (IMAGE_KEYS.has(k) && typeof v === 'string' && v) out.push({ path: v, at: `${at} → ${k}` });
      else collectImages(v, `${at} → ${k}`, out);
    }
  }
}

/** Format error Zod menjadi pesan bahasa Indonesia yang menunjuk entri bermasalah */
function formatIssues(file: string, data: unknown, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const [first, ...rest] = issue.path;
    let where = '';
    if (typeof first === 'number' && Array.isArray(data)) {
      const entry = data[first] as Record<string, unknown> | undefined;
      const label = entry?.name ?? entry?.title ?? entry?.message ?? entry?.altText;
      where = `entri #${first + 1}${label ? ` ("${String(label).slice(0, 40)}")` : ''}`;
      if (rest.length) where += ` → ${rest.join('.')}`;
    } else {
      where = issue.path.join('.') || '(isi file)';
    }
    return `  • ${file}: ${where}: ${issue.message}`;
  });
}

export async function validateContent(root: string): Promise<string[]> {
  const contentDir = path.join(root, 'src', 'content');
  const publicDir = path.join(root, 'public');
  const problems: string[] = [];

  for (const [file, schema] of Object.entries(CONTENT_FILES)) {
    const full = path.join(contentDir, file);
    let data: unknown;
    try {
      data = JSON.parse(await readFile(full, 'utf8'));
    } catch (error) {
      problems.push(`  • ${file}: file tidak bisa dibaca sebagai JSON (${(error as Error).message})`);
      continue;
    }
    const result = (schema as z.ZodType).safeParse(data);
    if (!result.success) problems.push(...formatIssues(file, data, result.error));

    const images: { path: string; at: string }[] = [];
    collectImages(data, file, images);
    for (const img of images) {
      const webp = img.path.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp');
      const found = existsSync(path.join(publicDir, img.path)) || existsSync(path.join(publicDir, webp));
      if (img.path.startsWith('/') && !found) {
        problems.push(`  • ${img.at}: gambar tidak ditemukan di public${img.path}`);
      }
    }
  }
  return problems;
}

async function readImageMeta(root: string): Promise<Record<string, { width: number; height: number }>> {
  const uploads = path.join(root, 'public', 'uploads');
  const meta: Record<string, { width: number; height: number }> = {};
  const walk = async (dir: string): Promise<void> => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(webp|jpe?g|png|gif|avif)$/i.test(entry.name)) {
        try {
          const m = await sharp(await readFile(full)).metadata();
          if (m.width && m.height) {
            const url = '/' + path.relative(path.join(root, 'public'), full).split(path.sep).join('/');
            meta[url] = { width: m.width, height: m.height };
          }
        } catch {
          /* file bukan gambar valid: dilaporkan oleh validasi bila dirujuk */
        }
      }
    }
  };
  await walk(uploads);
  return meta;
}

const header = (n: number) =>
  `\n✗ Konten tidak valid (${n} masalah). Perbaiki lewat Pages CMS atau file di src/content/:\n`;

export function contentPlugin(): Plugin {
  let root = process.cwd();
  let isBuild = false;

  const revalidate = async (server: ViteDevServer) => {
    const problems = await validateContent(root);
    if (problems.length) {
      const message = header(problems.length) + problems.join('\n');
      server.config.logger.error(message);
      server.ws.send({ type: 'error', err: { message, stack: '', plugin: 'cutless-content' } });
    }
  };

  return {
    name: 'cutless-content',
    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
    },
    async buildStart() {
      const problems = await validateContent(root);
      if (problems.length) {
        const message = header(problems.length) + problems.join('\n');
        if (isBuild) this.error(message);
        else this.warn(message);
      }
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(await readImageMeta(root))};`;
    },
    configureServer(server) {
      const contentDir = path.join(root, 'src', 'content');
      const uploadsDir = path.join(root, 'public', 'uploads');
      server.watcher.add(uploadsDir);
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(uploadsDir)) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: 'full-reload' });
        }
        if (file.startsWith(contentDir) && file.endsWith('.json')) void revalidate(server);
      });
    },
  };
}
