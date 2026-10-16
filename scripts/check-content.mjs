#!/usr/bin/env node
/**
 * Validasi konten tanpa build (dipakai CI di setiap Pull Request):
 *   - skema Zod, gambar yang dirujuk, relasi cabang (branchSlug tidak dikenal, slug ganda) → selalu GAGAL
 *   - aturan pra-launch (nomor contoh, kata "contoh", TODO, cabang Aktif tanpa WA/jam, ...) →
 *     GAGAL bila CONTENT_CHECK=strict (default), peringatan saja bila CONTENT_CHECK=warn
 *
 *   npm run check:content
 *   CONTENT_CHECK=warn npm run check:content
 *
 * Memakai logika yang sama persis dengan build (scripts/vite-content-plugin.ts → loadContent),
 * dimuat lewat Vite agar file TypeScript bisa dipakai tanpa dependensi tambahan.
 */
import { createServer } from 'vite';

const strict = (process.env.CONTENT_CHECK || 'strict') !== 'warn';
const inActions = process.env.GITHUB_ACTIONS === 'true';

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});

let exitCode = 0;
try {
  const { loadContent } = await server.ssrLoadModule('/scripts/vite-content-plugin.ts');
  const { errors, launch } = await loadContent(process.cwd());

  /** Anotasi GitHub (muncul di tab "Files changed" / ringkasan PR) */
  const annotate = (level, line) => {
    if (!inActions) return;
    const text = line.replace(/^\s*•\s*/, '');
    const file = text.match(/^([\w.-]+\.json)/)?.[1];
    console.log(`::${level}${file ? ` file=src/content/${file}` : ''}::${text.replace(/\r?\n/g, ' ')}`);
  };

  if (errors.length) {
    console.error(`\n✗ Konten tidak valid (${errors.length} masalah):\n${errors.join('\n')}`);
    errors.forEach((e) => annotate('error', e));
    exitCode = 1;
  }
  if (launch.length) {
    const title = strict ? '✗ Konten belum siap tayang' : '⚠ Konten belum siap tayang (CONTENT_CHECK=warn, tidak menggagalkan)';
    console[strict ? 'error' : 'warn'](`\n${title} (${launch.length} masalah):\n${launch.join('\n')}`);
    launch.forEach((e) => annotate(strict ? 'error' : 'warning', e));
    if (strict) exitCode = 1;
  }
  if (!errors.length && !launch.length) console.log('✓ Konten valid & siap tayang');
  else if (!exitCode) console.log('\n✓ Skema & relasi valid');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await server.close();
}
process.exit(exitCode);
