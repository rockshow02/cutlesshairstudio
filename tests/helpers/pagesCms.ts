/**
 * Tiruan validasi form Pages CMS (https://github.com/pages-cms/pages-cms) untuk tes: memastikan isi file konten bisa
 * disimpan lewat form tanpa "Please fix the errors before saving". Mengikuti kode Pages CMS:
 *  - lib/schema.ts initializeState: kunci hilang / null → nilai bawaan field (default, atau ""); list null → [];
 *    objek hilang/null → objek berisi nilai bawaan
 *  - components/entry/entry.tsx: file dengan `list: true` divalidasi sebagai { listWrapper: [...] }
 *  - fields/core/{string,text}: z.string() + required (min 1) + minlength/maxlength + pattern (juga pada "")
 *  - fields/core/number: "" boleh bila tidak wajib; selain itu Number(...) lalu min/max
 *  - fields/core/select: null/undefined → ""; "" boleh bila tidak wajib; nilai harus salah satu pilihan
 *    (multiple: array, tiap item harus pilihan; required = minimal 1)
 *  - list: array; required = minimal 1 item; list.min/max
 *  - boolean: true/false; date/file: string ("" boleh bila tidak wajib)
 *  - fields/core/image: path disimpan dengan awalan media.output (mis. /uploads/gallery), dibaca sebagai media.input
 *    (public/uploads/gallery) lalu harus diawali folder itu & berekstensi gambar (jpg, jpeg, png, webp, …)
 */
export interface CmsMedia {
  name: string;
  input: string;
  output: string;
  /** Ekstensi yang diizinkan folder ini (categories di .pages.yml diubah Pages CMS menjadi daftar ekstensi) */
  extensions?: string[];
  categories?: string[];
}
const IMAGE_EXT = ['jpg', 'jpeg', 'apng', 'png', 'gif', 'svg', 'ico', 'avif', 'bmp', 'tif', 'tiff', 'webp'];
let mediaConfigs: CmsMedia[] = [];
/** Folder media dari .pages.yml (dipakai pemeriksaan field image) */
export const setMedia = (media: CmsMedia[]) => {
  mediaConfigs = media;
};
export interface CmsField {
  name: string;
  type: string;
  label?: string | false;
  required?: boolean;
  default?: unknown;
  list?: boolean | { min?: number; max?: number; default?: unknown };
  options?: { maxlength?: number; minlength?: number; min?: number; max?: number; multiple?: boolean; media?: string | false; extensions?: string[]; values?: (string | { name?: string; value?: string })[] };
  pattern?: string | { regex: string; message?: string };
  fields?: CmsField[];
}

const DEFAULTS: Record<string, unknown> = { boolean: false };

function defaultValue(f: CmsField): unknown {
  if (f.default !== undefined) return f.default;
  if (f.type === 'object') return initialize(f.fields ?? [], {});
  return f.type in DEFAULTS ? DEFAULTS[f.type] : '';
}

/** Seperti initializeState: isi nilai bawaan untuk kunci hilang/null */
export function initialize(fields: CmsField[], data: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const src = data ?? {};
  const out: Record<string, unknown> = { ...src };
  for (const f of fields) {
    const v = src[f.name];
    if (f.list) {
      if (v === undefined) out[f.name] = typeof f.list === 'object' && f.list.default !== undefined ? f.list.default : [];
      else out[f.name] = Array.isArray(v) ? v.map((item) => (f.type === 'object' ? initialize(f.fields ?? [], item as Record<string, unknown>) : item)) : [];
    } else if (f.type === 'object') {
      out[f.name] = initialize(f.fields ?? [], v as Record<string, unknown>);
    } else {
      out[f.name] = v === undefined || v === null ? defaultValue(f) : v;
    }
  }
  return out;
}

const valuesOf = (f: CmsField) => (f.options?.values ?? []).map((v) => (typeof v === 'string' ? v : String(v.value ?? v.name)));

function checkScalar(f: CmsField, v: unknown, at: string, out: string[]) {
  const fail = (msg: string) => out.push(`${at}: ${msg} (nilai: ${JSON.stringify(v)?.slice(0, 60)})`);
  switch (f.type) {
    case 'string':
    case 'text': {
      if (typeof v !== 'string') return fail('harus teks');
      if (f.required && v.length < 1) return fail('wajib diisi');
      const pattern = typeof f.pattern === 'string' ? f.pattern : f.pattern?.regex;
      if (pattern && !new RegExp(pattern).test(v)) return fail(`tidak cocok pola ${pattern}`);
      if (f.options?.minlength && v.length < f.options.minlength) return fail(`minimal ${f.options.minlength} karakter`);
      if (f.options?.maxlength && v.length > f.options.maxlength) return fail(`lebih dari ${f.options.maxlength} karakter (${v.length})`);
      return;
    }
    case 'number': {
      if (v === '' && !f.required) return;
      const n = Number(v);
      if (Number.isNaN(n)) return fail('harus angka');
      if (f.options?.min !== undefined && n < f.options.min) return fail(`minimal ${f.options.min}`);
      if (f.options?.max !== undefined && n > f.options.max) return fail(`maksimal ${f.options.max}`);
      return;
    }
    case 'select': {
      const values = valuesOf(f);
      if (f.options?.multiple) {
        const arr = v === '' || v === null || v === undefined ? [] : v;
        if (!Array.isArray(arr)) return fail('harus daftar pilihan');
        if (f.required && arr.length < 1) return fail('wajib dipilih');
        for (const item of arr) if (!values.includes(String(item))) fail(`"${item}" bukan pilihan [${values.join(', ')}]`);
        return;
      }
      const s = v === null || v === undefined ? '' : v;
      if (s === '' && !f.required) return;
      if (typeof s !== 'string' || !values.includes(s)) return fail(`bukan pilihan [${values.join(', ')}]`);
      return;
    }
    case 'boolean':
      if (typeof v !== 'boolean') fail('harus true/false');
      return;
    case 'image': {
      if (v !== null && v !== undefined && typeof v !== 'string') return fail('harus path gambar');
      if (!v) return f.required ? fail('wajib diisi') : undefined;
      const media = f.options?.media === false ? undefined : mediaConfigs.find((m) => m.name === f.options?.media) ?? mediaConfigs[0];
      let path = v as string;
      if (media) {
        // read(): awalan output → input (tanpa garis miring di depan)
        if (path.startsWith(media.output)) path = `${media.input}/${path.slice(media.output.length).replace(/^\//, '')}`.replace(/^\//, '');
        if (!path.startsWith(media.input)) return fail(`harus di folder media ${media.output}`);
      }
      const ext = path.split('/').pop()!.split('.').pop() ?? '';
      if (!IMAGE_EXT.includes(ext)) fail(`ekstensi .${ext} bukan gambar`);
      return;
    }
    case 'file': {
      // fields/core/file: path di folder media; ekstensi = options.extensions ∩ ekstensi media (kosong = semua)
      if (v !== null && v !== undefined && typeof v !== 'string') return fail('harus path file');
      if (!v) return f.required ? fail('wajib diisi') : undefined;
      const media = f.options?.media === false ? undefined : mediaConfigs.find((m) => m.name === f.options?.media) ?? mediaConfigs[0];
      let path = v as string;
      if (media) {
        if (path.startsWith(media.output)) path = `${media.input}/${path.slice(media.output.length).replace(/^\//, '')}`.replace(/^\//, '');
        if (!path.startsWith(media.input)) return fail(`harus di folder media ${media.output}`);
      }
      const mediaExt = media?.extensions ?? (media?.categories?.includes('image') ? IMAGE_EXT : undefined);
      const allowed = (f.options?.extensions ?? mediaExt ?? []).filter((e) => !mediaExt || mediaExt.includes(e));
      const ext = (path.split('/').pop()!.split('.').pop() ?? '').toLowerCase();
      if (allowed.length && !allowed.includes(ext)) fail(`ekstensi .${ext} tidak diizinkan (${allowed.join(', ')})`);
      return;
    }
    default:
      // date, rich-text, code: teks
      if (typeof v !== 'string') return fail('harus teks');
      if (f.required && v.length < 1) fail('wajib diisi');
  }
}

function checkField(f: CmsField, v: unknown, at: string, out: string[]) {
  if (f.list) {
    if (!Array.isArray(v)) return out.push(`${at}: harus daftar`);
    const list = typeof f.list === 'object' ? f.list : {};
    if (f.required && v.length < 1) out.push(`${at}: minimal 1 isian`);
    if (list.min && v.length < list.min) out.push(`${at}: minimal ${list.min} isian`);
    if (list.max && v.length > list.max) out.push(`${at}: maksimal ${list.max} isian`);
    v.forEach((item, i) => checkItem(f, item, `${at}[${i}]`, out));
    return;
  }
  checkItem(f, v, at, out);
}

function checkItem(f: CmsField, v: unknown, at: string, out: string[]) {
  if (f.type === 'object') {
    for (const child of f.fields ?? []) checkField(child, (v as Record<string, unknown>)?.[child.name], `${at}.${child.name}`, out);
  } else checkScalar(f, v, at, out);
}

/** Pelanggaran aturan form Pages CMS untuk satu file konten */
export function validateCmsContent(entry: { fields: CmsField[]; list?: boolean }, content: unknown): string[] {
  const out: string[] = [];
  // Field list bernilai null: form Pages CMS di app.pagescms.org gagal menyimpan file seperti ini (Daftar Harga, Okt 2026),
  // walau versi kode terbarunya mengubah null menjadi []. Kosongkan dengan menghapus kuncinya (seperti yang ditulis CMS).
  const nullLists = (fields: CmsField[], item: unknown, at: string) => {
    for (const f of fields) {
      const v = (item as Record<string, unknown> | null)?.[f.name];
      if (f.list && v === null) out.push(`${at}.${f.name}: list bernilai null (hapus kuncinya atau isi [])`);
      if (f.type === 'object' && v && !f.list) nullLists(f.fields ?? [], v, `${at}.${f.name}`);
    }
  };
  if (Array.isArray(content)) content.forEach((item, i) => nullLists(entry.fields, item, `#${i + 1}`));
  else nullLists(entry.fields, content, '');
  if (entry.list) {
    if (!Array.isArray(content)) return ['isi file harus berupa daftar'];
    content.forEach((item, i) => {
      const value = initialize(entry.fields, item as Record<string, unknown>);
      for (const f of entry.fields) checkField(f, value[f.name], `#${i + 1}${(item as { name?: string })?.name ? ` (${(item as { name: string }).name})` : ''}.${f.name}`, out);
    });
  } else {
    const value = initialize(entry.fields, content as Record<string, unknown>);
    for (const f of entry.fields) checkField(f, value[f.name], f.name, out);
  }
  return out;
}

/* ---------- Simulasi simpan dari Pages CMS (lib/schema.ts + app/api/.../files/[path]/route.ts) ---------- */

const isEmptyValue = (v: unknown) => v === null || v === undefined || v === '';

/** Seperti sanitizeObject Pages CMS: hapus ""/null/undefined, list yang semua isinya kosong, dan objek kosong */
export function sanitizeObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => (v && typeof v === 'object' ? sanitizeObject(v) : v)).filter((v) => !isEmptyValue(v));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const key of Object.keys(out)) {
      if (out[key] && typeof out[key] === 'object') out[key] = sanitizeObject(out[key]);
      const v = out[key];
      if (
        (Array.isArray(v) && v.every(isEmptyValue)) ||
        (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) ||
        isEmptyValue(v)
      ) {
        delete out[key];
      }
    }
    return out;
  }
  return value;
}

/** Seperti deepMap Pages CMS: hanya field yang didefinisikan di .pages.yml yang ikut tersimpan */
function keepDefinedFields(fields: CmsField[], data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = data[f.name];
    if (f.list) out[f.name] = Array.isArray(v) ? v.map((item) => (f.type === 'object' ? keepDefinedFields(f.fields ?? [], (item ?? {}) as Record<string, unknown>) : item)) : v;
    else if (f.type === 'object') out[f.name] = keepDefinedFields(f.fields ?? [], (v ?? {}) as Record<string, unknown>);
    else out[f.name] = v;
  }
  return out;
}

/**
 * Isi file seperti setelah admin membuka entri di Pages CMS lalu menekan Save tanpa mengubah apa pun:
 * sanitize → initializeState (nilai form) → validasi form → simpan hanya field terdefinisi → sanitize (null, "", list
 * kosong, objek kosong dihapus). `errors` = pesan validasi yang membuat Save ditolak.
 */
export function simulateCmsSave(entry: { fields: CmsField[]; list?: boolean }, content: unknown): { saved: unknown; errors: string[] } {
  if (entry.list) {
    const items = (sanitizeObject(content) as unknown[] | undefined) ?? [];
    const formValues = items.map((item) => initialize(entry.fields, item as Record<string, unknown>));
    const errors = validateCmsContent(entry, formValues);
    const saved = sanitizeObject({ listWrapper: formValues.map((v) => keepDefinedFields(entry.fields, v)) }) as { listWrapper?: unknown[] };
    return { saved: saved.listWrapper ?? [], errors };
  }
  const formValues = initialize(entry.fields, sanitizeObject(content) as Record<string, unknown>);
  const errors = validateCmsContent(entry, formValues);
  return { saved: sanitizeObject(keepDefinedFields(entry.fields, formValues)), errors };
}
