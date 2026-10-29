/** Versi rilis (scripts/release.mjs): semver, tag terakhir, bagian CHANGELOG, dan pesan bila versi belum dinaikkan. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changelogSection, compareVersions, latestVersionTag, parseVersion, releaseProblems } from '../scripts/release.mjs';

const CHANGELOG = `# Catatan perubahan

## [Belum dirilis]

## [1.2.0] - 2026-10-29

### Ditambahkan
- Fitur B.

## [1.1.0] - 2026-10-27

### Diperbaiki
- Perbaikan A.

## [1.0.0] - 2026-10-24
- Launch.

[1.2.0]: https://example.test/compare/v1.1.0...v1.2.0
`;

describe('versi rilis', () => {
  it('semver & urutan versi', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2')).toBeNull();
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
    expect(latestVersionTag(['partner-page-v1', 'v1.0.0', 'v1.10.0', 'v1.9.0', 'archive/x'])).toBe('v1.10.0');
    expect(latestVersionTag(['archive/x'])).toBeUndefined();
  });

  it('bagian CHANGELOG satu versi (tanpa judul & tautan perbandingan di bawah)', () => {
    expect(changelogSection(CHANGELOG, '1.2.0')).toBe('### Ditambahkan\n- Fitur B.');
    expect(changelogSection(CHANGELOG, '1.0.0')).toBe('- Launch.');
    expect(changelogSection(CHANGELOG, '1.3.0')).toBeNull();
    expect(changelogSection(CHANGELOG.replace(/\n/g, '\r\n'), '1.1.0')).toBe('### Diperbaiki\n- Perbaikan A.');
  });

  it('siap rilis bila versi > tag terakhir, tag belum ada, dan bagian CHANGELOG bertanggal & berisi', () => {
    expect(releaseProblems({ version: '1.2.0', changelog: CHANGELOG, tags: ['v1.0.0', 'v1.1.0'] })).toEqual([]);
    expect(releaseProblems({ version: '1.2.0', changelog: CHANGELOG, tags: [] })).toEqual([]);
  });

  it('versi belum dinaikkan / CHANGELOG belum diisi → pesan yang menjelaskan perbaikannya', () => {
    const [same] = releaseProblems({ version: '1.1.0', changelog: CHANGELOG, tags: ['v1.0.0', 'v1.1.0'] });
    expect(same).toMatch(/Tag v1\.1\.0 sudah ada: versi belum dinaikkan\. Naikkan "version" di package\.json/);
    expect(releaseProblems({ version: '1.0.5', changelog: CHANGELOG.replace('[1.2.0]', '[1.0.5]'), tags: ['v1.1.0'] })[0]).toMatch(/tidak lebih tinggi dari rilis terakhir v1\.1\.0/);
    expect(releaseProblems({ version: '1.3.0', changelog: CHANGELOG, tags: ['v1.2.0'] })[0]).toMatch(/belum punya bagian "## \[1\.3\.0\] - YYYY-MM-DD"/);
    expect(releaseProblems({ version: '1.3.0', changelog: CHANGELOG.replace('## [Belum dirilis]', '## [1.3.0] - 2026-11-01'), tags: ['v1.2.0'] })[0]).toMatch(/masih kosong/);
    expect(releaseProblems({ version: '1.3.0', changelog: CHANGELOG.replace('## [Belum dirilis]', '## [1.3.0]\n- X'), tags: ['v1.2.0'] })[0]).toMatch(/belum bertanggal/);
    expect(releaseProblems({ version: '1.3', changelog: CHANGELOG, tags: [] })[0]).toMatch(/bukan semver/);
  });

  it('CHANGELOG.md repo: format Keep a Changelog, versi package.json punya bagian bertanggal', () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(changelog).toMatch(/^## \[Belum dirilis\]$/m);
    for (const v of ['1.0.0', '1.1.0', version]) expect(changelogSection(changelog, v), v).toBeTruthy();
    expect(releaseProblems({ version, changelog, tags: [] })).toEqual([]);
  });
});
