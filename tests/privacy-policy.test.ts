/**
 * Halaman /kebijakan-privasi/ (dibutuhkan Google OAuth consent screen): selalu tampil (tanpa toggle), masuk sitemap,
 * tidak lagi 404 di public/_redirects, terdaftar di build, tertaut di footer, dan teksnya hanya memuat fakta situs.
 * Data uji (bukan isi CMS).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY_EFFECTIVE, PRIVACY_PATH, privacyContact, privacySections, privacyTitle } from '../src/content/privacyPolicy';
import { sitemap } from '../scripts/vite-content-plugin';
import { contentFixture } from './helpers/contentFixture';

const facts = { brand: 'Studio Uji', branches: ['Bogor Bantarjati', 'Cibubur'], whatsapp: '0813-2220-932', email: 'halo@uji.test' };
const fullText = (f = facts) => privacySections(f).flatMap((s) => [s.heading, ...s.paragraphs, ...(s.items ?? [])]).join('\n');
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('isi kebijakan privasi', () => {
  it('menyebut siapa, cabang, WhatsApp & email', () => {
    const t = fullText();
    expect(t).toContain('Studio Uji (Bogor Bantarjati & Cibubur)');
    expect(t).toContain('0813-2220-932');
    expect(t).toContain('halo@uji.test');
  });

  it('tanpa email: hanya WhatsApp, tidak ada "undefined"/"null"', () => {
    const t = fullText({ ...facts, email: '' });
    expect(privacyContact({ ...facts, email: '' })).toBe('WhatsApp 0813-2220-932');
    expect(t).not.toMatch(/email|undefined|null/i);
  });

  it('mencakup semua data yang diproses, penyimpanan, hak, & tanggal berlaku', () => {
    const t = fullText();
    expect(t).toMatch(/Cloudflare Web Analytics[\s\S]*tidak memakai cookie/);
    for (const kolom of ['tanggal', 'jenis tombol', 'cabang', 'kapster', 'halaman asal', 'asal kunjungan', 'jumlah klik']) expect(t).toContain(kolom);
    expect(t).toMatch(/tidak menyimpan alamat IP, nomor HP, isi pesan, cookie, atau ID pengunjung/);
    expect(t).toMatch(/Percakapan terjadi di aplikasi WhatsApp, bukan di website/);
    expect(t).toMatch(/nama pengulas, jumlah bintang, isi ulasan, dan waktu ulasan dari Google Business Profile melalui API resmi Google/);
    expect(t).toMatch(/tidak dibagikan ke pihak lain/);
    expect(t).toMatch(/hanya dimuat setelah Anda menekan tombol putar/);
    expect(t).toMatch(/Cloudflare[\s\S]*tidak menjual atau membagikan/);
    expect(t).toMatch(/meminta data itu dihapus/);
    expect(t).toContain(`berlaku sejak ${PRIVACY_EFFECTIVE.label}`);
    expect(PRIVACY_EFFECTIVE.iso).toBe('2026-11-06');
  });

  it('judul memuat nama situs; bagian punya id unik', () => {
    expect(privacyTitle('Studio Uji')).toBe('Kebijakan Privasi | Studio Uji');
    const ids = privacySections(facts).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('halaman terdaftar di situs', () => {
  it('masuk sitemap (tanpa toggle)', () => {
    expect(sitemap(contentFixture())).toContain(`<loc>https://cutlesshairstudio.com${PRIVACY_PATH}</loc>`);
  });

  it('tidak 404 lagi di public/_redirects, dan tidak dialihkan', () => {
    const rules = read('public/_redirects')
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#'));
    expect(rules.some((l) => l.includes('kebijakan-privasi'))).toBe(false);
  });

  it('ikut build (vite.config.ts), tertaut di footer, template mengisi prerender', () => {
    expect(read('vite.config.ts')).toContain("'./kebijakan-privasi/index.html'");
    expect(read('src/components/layout/Footer.tsx')).toContain('pageUrl(PRIVACY_PATH)');
    expect(read('kebijakan-privasi/index.html')).toContain('<!--cutless:privacy-body-->');
  });
});
