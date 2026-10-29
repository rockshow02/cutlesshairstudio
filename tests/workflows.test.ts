/**
 * Alur rilis (CONTRIBUTING.md): pemicu & aturan di workflow GitHub Actions tidak hilang tanpa sengaja.
 * Konten → main (CI verify tiap push), fitur → staging → rilis berversi, hotfix → main, sinkron main → staging.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = { name?: string; if?: string; run?: string; env?: Record<string, string> };
type Workflow = { on: Record<string, { branches?: string[]; types?: string[] } | null>; jobs: Record<string, { if?: string; steps: Step[] }> };
const workflow = (file: string) => parse(readFileSync(`.github/workflows/${file}`, 'utf8')) as Workflow;

describe('izin GITHUB_TOKEN (default repo tetap "Read"; izin tulis hanya eksplisit & minimum)', () => {
  /** Izin yang diharapkan per workflow; workflow baru wajib ditambahkan di sini */
  const EXPECTED: Record<string, Record<string, string>> = {
    'ci.yml': { contents: 'read' },
    'optimize-images.yml': { contents: 'write' },
    'sync-staging.yml': { contents: 'write', 'pull-requests': 'write' },
    'release.yml': { contents: 'write' },
  };

  it('setiap workflow punya blok permissions eksplisit di tingkat workflow, persis set minimum', () => {
    const files = readdirSync('.github/workflows').filter((f) => /\.ya?ml$/.test(f)).sort();
    expect(files).toEqual(Object.keys(EXPECTED).sort());
    for (const file of files) {
      const w = workflow(file) as Workflow & { permissions?: unknown };
      expect(w.permissions, file).toEqual(EXPECTED[file]);
      // Tidak ada job yang menaikkan izin sendiri (write-all / read-all / blok job)
      for (const [name, job] of Object.entries(w.jobs)) expect((job as { permissions?: unknown }).permissions, `${file} → ${name}`).toBeUndefined();
    }
  });
});

describe('workflow alur rilis', () => {
  it('CI: push ke main & staging, PR ke main/staging; e2e tidak diulang untuk push ke main', () => {
    const ci = workflow('ci.yml');
    expect(ci.on.push?.branches).toEqual(['staging', 'main']);
    expect(ci.on.pull_request?.branches).toEqual(['main', 'staging']);
    expect(ci.jobs.e2e.if).toContain("github.ref_name != 'main'");
  });

  it('CI: PR ke main hanya dari staging & hotfix/*, cek versi rilis, ringkasan bila konten di main gagal', () => {
    const steps = workflow('ci.yml').jobs.verify.steps;
    const guard = steps.find((s) => s.name?.startsWith('Asal PR ke main'))!;
    expect(guard.run).toMatch(/staging\|hotfix\/\*\)/);
    expect(guard.run).toContain('CONTRIBUTING.md');
    expect(steps.find((s) => s.run === 'node scripts/release.mjs check')?.if).toContain("github.base_ref == 'main'");
    const summary = steps.find((s) => s.name === 'Ringkasan bila konten di main gagal')!;
    expect(summary.if).toContain("github.ref_name == 'main'");
    expect(summary.run).toContain('versi sebelumnya tetap tayang');
    // Validasi konten ketat untuk main (PR & push), longgar untuk staging
    expect(steps.find((s) => s.run === 'npm run check:content')?.env?.CONTENT_CHECK).toBe("${{ env.TARGET == 'main' && 'strict' || 'warn' }}");
  });

  it('Rilis versi: setelah PR staging / hotfix/* ke main di-merge → tag & GitHub Release dari CHANGELOG', () => {
    const release = workflow('release.yml');
    expect(release.on.pull_request).toEqual({ types: ['closed'], branches: ['main'] });
    expect(release.jobs.release.if).toContain('github.event.pull_request.merged == true');
    expect(release.jobs.release.if).toContain("head.ref == 'staging'");
    expect(release.jobs.release.if).toContain("startsWith(github.event.pull_request.head.ref, 'hotfix/')");
    const run = release.jobs.release.steps.map((s) => s.run ?? '').join('\n');
    expect(run).toContain('node scripts/release.mjs check');
    expect(run).toContain('gh release create');
  });

  it('Sinkron main → staging: setiap push ke main (+ jadwal cadangan), satu run dalam satu waktu, logika di skrip teruji', () => {
    const sync = workflow('sync-staging.yml') as Workflow & { concurrency: unknown; env: { LABEL: string } };
    expect(sync.on.push?.branches).toEqual(['main']);
    expect(sync.on).toHaveProperty('schedule');
    expect(sync.concurrency).toEqual({ group: 'sinkron-staging', 'cancel-in-progress': false });
    expect(sync.env.LABEL).toBe('perlu-dicek');
    const steps = sync.jobs.sync.steps;
    // Merge + pemeriksaan + push (dengan ulang) di scripts/sync-staging.mjs (tests/syncStaging.test.ts), dari salinan di luar checkout
    const main = steps.find((s) => s.run?.includes('sync-staging.mjs'))!;
    expect(main.run).toContain('node "$RUNNER_TEMP/sync-staging.mjs" --cwd "$GITHUB_WORKSPACE"');
  });

  it('Sinkron: PR hanya saat gagal sungguhan (PR bot memicu CI yang kedaluwarsa merah), berlabel perlu-dicek + ringkasan run', () => {
    const steps = workflow('sync-staging.yml').jobs.sync.steps;
    const prSteps = steps.filter((s) => s.run?.includes('gh pr create'));
    expect(prSteps).toHaveLength(1);
    const notify = prSteps[0];
    expect(notify.if).toBe('failure()');
    expect(notify.run).toContain('--label "$LABEL"');
    expect(notify.run).toContain('gh pr edit "$pr" --add-label "$LABEL"');
    expect(notify.run).toContain('GITHUB_STEP_SUMMARY');
    expect(notify.env?.REASON).toBe('${{ steps.sync.outputs.reason }}');
    // Langkah pemberitahuan adalah yang terakhir dan tidak menelan kegagalan (run tetap merah)
    expect(steps.at(-1)).toBe(notify);
    expect(notify.run).not.toMatch(/exit 0/);
  });
});
