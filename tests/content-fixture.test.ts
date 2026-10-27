/** Data uji bersama (tests/helpers/contentFixture.ts) lolos skema & pemeriksaan lintas file tanpa error struktur. */
import { describe, expect, it } from 'vitest';
import { CONTENT_FILES, crossCheck } from '../src/content/schema';
import { contentFixture, rawFixture } from './helpers/contentFixture';

describe('data uji bersama', () => {
  it('setiap file konten punya data uji yang lolos skema', () => {
    for (const file of Object.keys(CONTENT_FILES)) expect(rawFixture, file).toHaveProperty(file.replace('.json', ''));
    expect(() => contentFixture()).not.toThrow();
  });

  it('tanpa error struktur & siap tayang', () => {
    const r = crossCheck(contentFixture());
    expect(r.errors).toEqual([]);
    expect(r.launch).toEqual([]);
  });
});
