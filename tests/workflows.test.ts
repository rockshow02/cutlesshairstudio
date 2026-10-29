/**
 * Alur rilis (CONTRIBUTING.md): pemicu & aturan di workflow GitHub Actions tidak hilang tanpa sengaja.
 * Konten → main (CI verify tiap push), fitur → staging → rilis berversi, hotfix → main, sinkron main → staging.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = { name?: string; if?: string; run?: string; env?: Record<string, string> };
type Workflow = { on: Record<string, { branches?: string[]; types?: string[] } | null>; jobs: Record<string, { if?: string; steps: Step[] }> };
const workflow = (file: string) => parse(readFileSync(`.github/workflows/${file}`, 'utf8')) as Workflow;

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

  it('Sinkron main → staging: setiap push ke main (+ jadwal cadangan), label perlu-dicek, pemeriksaan sebelum push', () => {
    const sync = workflow('sync-staging.yml');
    expect(sync.on.push?.branches).toEqual(['main']);
    expect(sync.on).toHaveProperty('schedule');
    expect((sync as unknown as { env: { LABEL: string } }).env.LABEL).toBe('perlu-dicek');
    const steps = sync.jobs.sync.steps;
    const names = steps.map((s) => s.name);
    expect(names.indexOf('Pemeriksaan (sama dengan CI staging)')).toBeLessThan(names.indexOf('Push hasil merge ke staging'));
    expect(steps.find((s) => s.name === 'Push hasil merge ke staging')?.if).toContain("steps.checks.outcome == 'success'");
  });
});
