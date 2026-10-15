# Cutless Hair Studio, frontend (React)

> Bagian dari monorepo. Lihat [README root](../README.md) untuk CMS (Strapi), env, seed, dan deploy.

Migrasi dari template `brber-master` (HTML/jQuery) ke **Vite + React 18 + TypeScript + CSS Modules**.
Identitas visual (logo, palet, font Archivo + Plus Jakarta Sans) sama dengan versi yang sudah disetujui.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + build produksi ke dist/
npm run preview    # cek hasil build
npm run typecheck
```

Uji state loading: `VITE_CONTENT_DELAY=1500 npm run dev` (PowerShell: `$env:VITE_CONTENT_DELAY=1500; npm run dev`).

Library tambahan hanya **Swiper** (slider testimoni). Animasi pakai IntersectionObserver + CSS; React Router tidak diperlukan (satu halaman).

## Struktur

```
src/
  components/
    layout/    Navbar, Footer, FloatingWhatsApp, Preloader, StructuredData (JSON-LD)
    sections/  Hero, About, Services, Pricing, Barbers, Gallery, Testimonials, Location, CtaBanner
    ui/        Button, Card, SectionTitle, Container, Section, SectionState, Reveal, Icon, ResponsiveImage, Stars, PlaceholderBadge
  content/     data konten (sumber sementara sebelum CMS), ditandai // TODO:
  lib/         content.ts (lapisan data), whatsapp.ts, format.ts, asset.ts, hooks
  types/       tipe konten = acuan skema CMS
  styles/      tokens.css (warna, spacing, z-index), global.css
public/images/ semua aset gambar, direferensikan lewat path di data
```

## Lapisan data & CMS

Komponen **hanya** memanggil fungsi async di `src/lib/content.ts`. Sejak tahap 1 CMS, fungsi ini mengambil data dari
Strapi (`VITE_CMS_URL`) lewat `src/lib/cms/` (client dengan timeout 5 detik, serializer query, tipe respons, mapper),
di-cache TanStack Query 5 menit, dan **fallback ke `src/content/`** bila CMS mati/lambat. Detail: [README root](../README.md).

| File konten | Getter | Tipe | Sumber tahap 1 |
|---|---|---|---|
| `site.ts` | `getSite()` | `SiteContent` | CMS Pengaturan Situs + statis (label UI, SEO, menu) |
| `socials.ts` | `getSocials()` | `SocialLink[]` | CMS Pengaturan Situs (URL) |
| `locations.ts` | `getLocations()` | `LocationsContent` | Statis; cabang utama ditimpa alamat/jam/Maps dari CMS |
| `pricing.ts` | `getPricing()` | `PricingContent` | CMS Daftar Harga (`Paket` → kartu paket) |
| `barbers.ts` | `getBarbers()` | `BarbersContent` | CMS Barber |
| `gallery.ts` | `getGallery()` | `GalleryContent` | CMS Galeri (+ before/after statis) |
| `promo.ts` | `getPromos()` | `PromoContent` | CMS Promo (fallback: kosong) |
| `announcements.ts` | `getAnnouncements()` | `Announcement[]` | CMS Pengumuman (fallback: kosong) |
| `hero.ts`, `about.ts`, `services.ts`, `testimonials.ts`, `cta.ts` | `getHero()` dst. | lihat `src/types` | Statis |

Tipe bersama (`types/common.ts`): `ImageAsset`, `SectionHeading`, `Cta` / `CtaAction` (whatsapp | link), `IconName`.

## WhatsApp

Semua tombol booking memakai `buildWhatsAppLink(nomor, pesan)` (`src/lib/whatsapp.ts`).
Template pesan ada di `site.whatsapp.templates` dengan placeholder `{brand} {service} {barber} {branch} {package}`.
Tombol per layanan/barber/paket/cabang mengisi namanya otomatis.

## Skala z-index (tokens.css)

| Lapisan | Nilai |
|---|---|
| konten | 1 |
| navbar | 50 |
| tombol WA melayang | 60 |
| menu mobile | 70 |
| preloader | 100 |
| lightbox galeri | top layer `<dialog>` native |

## Lisensi template

Footer menampilkan kredit Colorlib (template `brber-master` berlisensi CC BY 3.0). Jangan dihapus kecuali membeli lisensi.
