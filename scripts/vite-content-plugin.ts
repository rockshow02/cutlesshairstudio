/**
 * Plugin Vite untuk konten Pages CMS:
 * 1. Validasi src/content/*.json (skema Zod + relasi cabang + kesiapan launch) saat build.
 *    Konten tidak valid → build GAGAL. Konten belum siap tayang → GAGAL bila CONTENT_CHECK=strict
 *    (default produksi, .env.production), hanya peringatan + badge bila warn (development/staging).
 *    Di dev server, konten tidak valid (mis. dari Pages CMS) tampil sebagai overlay error di browser.
 * 2. Memastikan setiap gambar yang dirujuk konten benar-benar ada di public/.
 * 3. Modul virtual `virtual:image-meta`: ukuran asli tiap gambar di public/uploads.
 * 4. Head HTML dari settings.json → siteUrl adalah SATU-SATUNYA sumber domain
 *    (canonical, og:url, og:image, twitter:image, sitemap.xml, robots.txt).
 *    VITE_SITE_URL (.env.development/.env.staging) menggantinya per environment.
 * 6. Environment selain produksi: noindex (meta, robots.txt Disallow, header X-Robots-Tag), judul berawalan
 *    [DEV]/[STAGING], modul `virtual:content-status` untuk badge. Web Analytics hanya di produksi.
 * 5. Prerender /cabang/<slug>/index.html per cabang (title/meta unik + JSON-LD HairSalon + ringkasan statis).
 */
import { readdir, readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import { CONTENT_FILES, crossCheck, type BranchEntry, type ContentBundle, type ContentIssue } from '../src/content/schema';

const VIRTUAL_ID = 'virtual:image-meta';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const STATUS_ID = 'virtual:content-status';
const RESOLVED_STATUS_ID = `\0${STATUS_ID}`;
const IMAGE_KEYS = new Set(['photo', 'image', 'logo']);
const OG_IMAGE = '/images/og/og-cutless.jpg';
const BRANCH_ROUTE = /^\/cabang\/([a-z0-9-]+)\/?(?:index\.html)?(?:[?#].*)?$/;

/* ---------- Validasi ---------- */

function collectImages(value: unknown, at: string, out: { path: string; at: string }[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      const entry = v as Record<string, unknown> | null;
      const label = entry?.name ?? entry?.title ?? entry?.altText;
      collectImages(v, `${at}: entri #${i + 1}${label ? ` ("${String(label).slice(0, 40)}")` : ''}`, out);
    });
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (IMAGE_KEYS.has(k) && typeof v === 'string' && v) out.push({ path: v, at: `${at} → ${k}` });
      else collectImages(v, `${at} → ${k}`, out);
    }
  }
}

function formatIssues(file: string, data: unknown, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const [first, ...rest] = issue.path;
    let where: string;
    if (typeof first === 'number' && Array.isArray(data)) {
      const entry = data[first] as Record<string, unknown> | undefined;
      const label = entry?.name ?? entry?.title ?? entry?.message ?? entry?.author ?? entry?.altText ?? entry?.slug;
      where = `entri #${first + 1}${label ? ` ("${String(label).slice(0, 40)}")` : ''}`;
      if (rest.length) where += ` → ${rest.join('.')}`;
    } else {
      where = issue.path.join('.') || '(isi file)';
    }
    return `  • ${file}: ${where}: ${issue.message}`;
  });
}

const formatCross = (issues: ContentIssue[]) => issues.map((i) => `  • ${i.file}: ${i.where}: ${i.message}`);

interface LoadResult {
  /** Masalah skema, gambar, dan relasi → selalu error */
  errors: string[];
  /** Konten belum siap tayang → error saat build (kecuali CONTENT_CHECK=warn) */
  launch: string[];
  bundle?: ContentBundle;
}

export async function loadContent(root: string): Promise<LoadResult> {
  const contentDir = path.join(root, 'src', 'content');
  const publicDir = path.join(root, 'public');
  const errors: string[] = [];
  const parsed: Record<string, unknown> = {};

  for (const [file, schema] of Object.entries(CONTENT_FILES)) {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(path.join(contentDir, file), 'utf8'));
    } catch (error) {
      errors.push(`  • ${file}: file tidak bisa dibaca sebagai JSON (${(error as Error).message})`);
      continue;
    }
    const result = (schema as z.ZodType).safeParse(data);
    if (result.success) parsed[file.replace('.json', '')] = result.data;
    else errors.push(...formatIssues(file, data, result.error));

    const images: { path: string; at: string }[] = [];
    collectImages(data, file, images);
    for (const img of images) {
      const webp = img.path.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp');
      const found = existsSync(path.join(publicDir, img.path)) || existsSync(path.join(publicDir, webp));
      if (img.path.startsWith('/') && !found) errors.push(`  • ${img.at}: gambar tidak ditemukan di public${img.path}`);
    }
  }

  // Video preloader (opsional): harus ada & ringan agar tidak menunda halaman
  const video = (parsed.settings as { preloaderVideo?: string | null } | undefined)?.preloaderVideo;
  if (video) {
    const file = path.join(publicDir, video);
    if (!existsSync(file)) errors.push(`  • settings.json: preloaderVideo: file tidak ditemukan di public${video}`);
    else if ((await stat(file)).size > 500 * 1024) {
      errors.push(`  • settings.json: preloaderVideo: ${video} lebih dari 500 KB, kompres dulu (mis. 720p, tanpa suara, ±1,5 detik)`);
    }
  }

  if (Object.keys(parsed).length !== Object.keys(CONTENT_FILES).length) return { errors, launch: [] };
  const bundle = parsed as unknown as ContentBundle;
  const cross = crossCheck(bundle);
  return { errors: [...errors, ...formatCross(cross.errors)], launch: formatCross(cross.launch), bundle };
}

/* ---------- Ukuran gambar ---------- */

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

/* ---------- SEO: head, JSON-LD, sitemap ---------- */

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const joinCities = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`);
const DAY_EN: Record<string, string> = {
  Senin: 'Monday', Selasa: 'Tuesday', Rabu: 'Wednesday', Kamis: 'Thursday', Jumat: 'Friday', Sabtu: 'Saturday', Minggu: 'Sunday',
};
const isWa = (n: string) => /^62\d{8,13}$/.test(n);
/** Potong di batas kata (meta description ≤ 160 karakter) */
const clip = (text: string, max = 160) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[\s,.;:]+$/, '')}…`;
};
const imageUrl = (siteUrl: string, src: string) => `${siteUrl}${src.replace(/\.(jpe?g|png|gif|tiff?|avif)$/i, '.webp')}`;

function citiesOf(bundle: ContentBundle): string {
  const operating = bundle.branches.filter((b) => b.status !== 'Segera Dibuka');
  return joinCities([...new Set((operating.length ? operating : bundle.branches).map((b) => b.city))]);
}

function branchJsonLd(b: BranchEntry, bundle: ContentBundle) {
  const { siteUrl, siteName } = bundle.settings;
  const url = `${siteUrl}/cabang/${b.slug}/`;
  const hours = b.openingHours.filter((h) => !h.isClosed && h.openTime && h.closeTime);
  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    '@id': `${url}#salon`,
    name: `${siteName} ${b.name}`,
    url,
    image: b.photo ? imageUrl(siteUrl, b.photo) : `${siteUrl}${OG_IMAGE}`,
    ...(isWa(b.whatsappNumber) ? { telephone: `+${b.whatsappNumber}` } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(b.address ? { streetAddress: b.address } : {}),
      addressLocality: b.city,
      addressRegion: b.province,
      addressCountry: 'ID',
    },
    ...(b.latitude !== null && b.longitude !== null && b.latitude !== undefined && b.longitude !== undefined
      ? { geo: { '@type': 'GeoCoordinates', latitude: b.latitude, longitude: b.longitude } }
      : {}),
    ...(b.status === 'Aktif' && hours.length
      ? {
          openingHoursSpecification: hours.map((h) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: DAY_EN[h.day],
            opens: h.openTime,
            closes: h.closeTime,
          })),
        }
      : {}),
    ...(b.googleMapsUrl ? { hasMap: b.googleMapsUrl } : {}),
    parentOrganization: { '@type': 'Organization', name: siteName, url: `${siteUrl}/` },
  };
}

const jsonLdTag = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function branchHead(b: BranchEntry, bundle: ContentBundle): string {
  const { siteUrl, siteName } = bundle.settings;
  const url = `${siteUrl}/cabang/${b.slug}/`;
  const title = `${siteName} ${b.name} | Barbershop di ${b.city}`;
  const where = b.address ? b.address : `${b.city}, ${b.province}`;
  const description = clip(
    b.status === 'Segera Dibuka'
      ? `${siteName} segera hadir di ${b.city}. Cabang baru dengan hairstylist yang sama on point-nya.`
      : `${siteName} cabang ${b.name}: cek jam buka hari ini, daftar harga, hairstylist, promo, dan booking via WhatsApp. ${where}`
  );
  const image = b.photo ? imageUrl(siteUrl, b.photo) : `${siteUrl}${OG_IMAGE}`;
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    jsonLdTag(branchJsonLd(b, bundle)),
  ].join('\n    ');
}

/** Ringkasan statis di dalam #root (terbaca crawler; diganti React saat halaman dimuat) */
function branchBody(b: BranchEntry, bundle: ContentBundle): string {
  const { siteName } = bundle.settings;
  const hours = b.openingHours
    .map((h) => `<li>${esc(h.day)}: ${h.isClosed || !h.openTime || !h.closeTime ? 'Tutup' : `${h.openTime.replace(':', '.')} – ${h.closeTime.replace(':', '.')}`}</li>`)
    .join('');
  return [
    '<div class="prerender">',
    `<h1>${esc(siteName)} ${esc(b.name)}</h1>`,
    `<p>${esc(b.address ?? `${b.city}, ${b.province}`)}</p>`,
    b.status !== 'Aktif' ? `<p>${esc(b.status)}</p>` : '',
    isWa(b.whatsappNumber) && b.status === 'Aktif' ? `<p>WhatsApp: <a href="https://wa.me/${b.whatsappNumber}">+${b.whatsappNumber}</a></p>` : '',
    hours ? `<h2>Jam operasional</h2><ul>${hours}</ul>` : '',
    '<p><a href="/cabang/">Semua cabang</a> · <a href="/">Beranda</a></p>',
    '</div>',
  ].join('');
}

function fillHtml(html: string, bundle: ContentBundle | undefined): string {
  if (!bundle) return html;
  const { siteUrl, siteName } = bundle.settings;
  const allBranches = jsonLdTag(bundle.branches.map((b) => branchJsonLd(b, bundle)));
  return html
    .replaceAll('%SITE_URL%', siteUrl)
    .replaceAll('%BRAND%', esc(siteName))
    .replaceAll('%CITIES%', esc(citiesOf(bundle)))
    .replaceAll('%OG_IMAGE%', `${siteUrl}${OG_IMAGE}`)
    .replace('<!--cutless:jsonld-->', allBranches);
}

const HEAD_REGION = /<!--cutless:head-start-->[\s\S]*?<!--cutless:head-end-->/;

function sitemap(bundle: ContentBundle): string {
  const { siteUrl } = bundle.settings;
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    '/',
    '/cabang/',
    ...bundle.branches.map((b) => `/cabang/${b.slug}/`),
    ...(bundle.settings.showProducts ? ['/produk/'] : []),
  ];
  const body = urls.map((u) => `  <url><loc>${siteUrl}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const robots = (bundle: ContentBundle, indexable: boolean) =>
  indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${bundle.settings.siteUrl}/sitemap.xml\n`
    : '# Bukan produksi: jangan diindeks\nUser-agent: *\nDisallow: /\n';

/* ---------- Environment ---------- */

type AppEnv = 'development' | 'staging' | 'production';
const ENV_TAG: Record<AppEnv, string> = { development: '[DEV] ', staging: '[STAGING] ', production: '' };

/** Penanda environment di HTML (idempoten: aman dipanggil dua kali pada halaman yang sama) */
function applyEnv(html: string, env: AppEnv, analyticsToken: string): string {
  if (env === 'production') {
    if (!analyticsToken || html.includes('cloudflareinsights')) return html;
    const beacon = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: analyticsToken })}'></script>`;
    return html.replace('</body>', `    ${beacon}\n  </body>`);
  }
  let out = html;
  if (!out.includes('name="robots"')) out = out.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex, nofollow" />');
  if (!out.includes(`<title>${ENV_TAG[env]}`)) out = out.replace('<title>', `<title>${ENV_TAG[env]}`);
  return out;
}

const NOINDEX_HEADERS = '\n# Bukan produksi (ditambahkan saat build): jangan diindeks mesin pencari\n/*\n  X-Robots-Tag: noindex, nofollow\n';

/* ---------- Plugin ---------- */

const header = (title: string, n: number) => `\n✗ ${title} (${n} masalah). Perbaiki lewat Pages CMS atau file di src/content/:\n`;

export function contentPlugin(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  let isBuild = false;
  let bundle: ContentBundle | undefined;
  let appEnv: AppEnv = 'production';
  let siteUrlOverride = '';
  let analyticsToken = '';
  let lenient = false;
  /** Masalah "siap tayang" terakhir (untuk badge DEV/STAGING) */
  let launchIssues: string[] = [];
  /** Pesan konten tidak valid terakhir di dev server (dikirim ulang ke browser yang baru terhubung) */
  let devError: string | null = null;

  const refresh = async () => {
    const result = await loadContent(root);
    if (result.bundle && siteUrlOverride) {
      result.bundle = { ...result.bundle, settings: { ...result.bundle.settings, siteUrl: siteUrlOverride } };
    }
    bundle = result.bundle ?? bundle;
    launchIssues = result.bundle ? result.launch : launchIssues;
    return result;
  };

  const sendOverlay = (server: ViteDevServer) => {
    if (devError) server.ws.send({ type: 'error', err: { message: devError, stack: '', plugin: 'cutless-content' } });
  };

  const revalidate = async (server: ViteDevServer) => {
    const before = launchIssues.join('\n');
    const { errors, launch } = await refresh();
    devError = errors.length ? header('Konten tidak valid', errors.length) + errors.join('\n') : null;
    if (devError) server.config.logger.warn(devError);
    if (launch.length) server.config.logger.warn(header('Konten belum siap tayang', launch.length) + launch.join('\n'));
    if (devError) return sendOverlay(server);
    if (launchIssues.join('\n') !== before) {
      const mod = server.moduleGraph.getModuleById(RESOLVED_STATUS_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
    }
  };

  return {
    name: 'cutless-content',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
      // .env.<mode> (+ variabel proses, yang selalu menang): VITE_APP_ENV, VITE_SITE_URL, CONTENT_CHECK, ...
      const env = loadEnv(config.mode, config.envDir || config.root, '');
      appEnv = (['development', 'staging', 'production'] as const).find((e) => e === env.VITE_APP_ENV)
        ?? (config.mode === 'production' ? 'production' : 'development');
      siteUrlOverride = (env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '');
      analyticsToken = (env.VITE_CF_ANALYTICS_TOKEN ?? '').trim();
      lenient = (env.CONTENT_CHECK || (appEnv === 'production' ? 'strict' : 'warn')) === 'warn';
      if (isBuild) console.log(`• Environment: ${appEnv} · siteUrl: ${siteUrlOverride || '(Pengaturan Situs)'} · cek siap tayang: ${lenient ? 'warn' : 'strict'}`);
    },

    async buildStart() {
      const { errors, launch } = await refresh();
      if (errors.length) {
        const message = header('Konten tidak valid', errors.length) + errors.join('\n');
        if (isBuild) this.error(message);
        devError = message;
        this.warn(message);
      }
      if (launch.length) {
        const message =
          header('Konten belum siap tayang', launch.length) +
          launch.join('\n') +
          (lenient ? `\n  (CONTENT_CHECK=warn [${appEnv}]: hanya peringatan. Produksi memakai strict: build akan gagal)` : '');
        if (isBuild && !lenient) this.error(message);
        else this.warn(message);
      }
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      if (id === STATUS_ID) return RESOLVED_STATUS_ID;
      return null;
    },
    async load(id) {
      if (id === RESOLVED_STATUS_ID) {
        return `export default ${JSON.stringify({ issues: appEnv === 'production' ? [] : launchIssues })};`;
      }
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(await readImageMeta(root))};`;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        let out = fillHtml(html, bundle);
        // Dev server: /cabang/<slug>/ memakai head cabang tersebut
        const slug = ctx.originalUrl?.match(BRANCH_ROUTE)?.[1];
        const branch = slug && bundle?.branches.find((b) => b.slug === slug);
        if (branch && bundle) {
          out = out.replace(HEAD_REGION, branchHead(branch, bundle)).replace('<!--cutless:body-->', branchBody(branch, bundle));
        }
        return applyEnv(out, appEnv, analyticsToken);
      },
    },

    generateBundle() {
      if (!bundle) return;
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(bundle) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots(bundle, appEnv === 'production') });
    },

    /** Prerender halaman per cabang dari dist/cabang/index.html */
    async closeBundle() {
      if (!isBuild || !bundle) return;
      // Staging: header X-Robots-Tag dari Worker (static assets membaca dist/_headers)
      const headersFile = path.join(outDir, '_headers');
      if (appEnv !== 'production' && existsSync(headersFile)) {
        const current = await readFile(headersFile, 'utf8');
        if (!current.includes('X-Robots-Tag')) await writeFile(headersFile, current.trimEnd() + '\n' + NOINDEX_HEADERS);
      }
      const template = path.join(outDir, 'cabang', 'index.html');
      if (!existsSync(template)) return;
      const html = await readFile(template, 'utf8');
      for (const branch of bundle.branches) {
        const dir = path.join(outDir, 'cabang', branch.slug);
        await mkdir(dir, { recursive: true });
        const page = applyEnv(
          html.replace(HEAD_REGION, branchHead(branch, bundle)).replace('<!--cutless:body-->', branchBody(branch, bundle)),
          appEnv,
          analyticsToken,
        );
        await writeFile(path.join(dir, 'index.html'), page);
      }
      console.log(`✓ ${bundle.branches.length} halaman cabang diprerender`);
    },

    configureServer(server) {
      const contentDir = path.join(root, 'src', 'content');
      const uploadsDir = path.join(root, 'public', 'uploads');
      // /cabang/<slug>/ → template cabang (dev server; di produksi file statis hasil prerender)
      server.middlewares.use((req, _res, next) => {
        if (req.url && BRANCH_ROUTE.test(req.url)) req.url = '/cabang/index.html';
        next();
      });
      server.watcher.add(uploadsDir);
      // Browser yang baru dibuka/di-refresh tetap melihat overlay bila konten masih tidak valid
      server.ws.on('connection', () => sendOverlay(server));
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
