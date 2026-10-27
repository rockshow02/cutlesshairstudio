/**
 * Alamat cabang untuk JSON-LD (schema.org PostalAddress). Kolom "Alamat lengkap" di Pages CMS boleh berisi alamat
 * lengkap seperti yang tampil di halaman (mis. "Jl. Alternatif Cibubur No.87, Harjamukti, Kec. Cimanggis, Kota Depok,
 * Jawa Barat 16454"); bagian kota, provinsi, dan kode pos di AKHIR alamat dipisahkan agar streetAddress tidak
 * mengulang addressLocality/addressRegion/postalCode. Tanpa import runtime (dipakai plugin build).
 */

/** Kode pos Indonesia: 5 digit angka */
export const POSTAL_CODE = /^\d{5}$/;

export interface BranchAddressInput {
  address?: string | null;
  city: string;
  province: string;
  postalCode?: string | null;
}

export interface PostalAddressParts {
  streetAddress?: string;
  addressLocality: string;
  addressRegion: string;
  postalCode?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const CITY_PREFIX = /^(?:kota(?:\s+administrasi)?|kabupaten|kab\.)\s+(.+)$/i;
const PROVINCE_PREFIX = /^(?:provinsi|prov\.)\s+/i;

/**
 * streetAddress = jalan + RT/RW + kelurahan + kecamatan (bagian awal alamat);
 * addressLocality = "Kota/Kabupaten …" di alamat, bila ada, selain itu kolom Kota;
 * addressRegion = kolom Provinsi; postalCode = kolom Kode pos, bila kosong 5 digit di akhir alamat.
 */
export function postalAddressParts(b: BranchAddressInput): PostalAddressParts {
  const parts = (b.address ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  let postal = b.postalCode?.trim() || undefined;
  let locality: string | undefined;

  // Dari belakang: "Jawa Barat 16454" / "16454" / "Jawa Barat" / "Kota Depok" / "Depok" / "Indonesia"
  for (let guard = 0; parts.length > 1 && guard < 5; guard++) {
    const last = parts[parts.length - 1];
    const withPostal = /^(.*?)\s*(\d{5})$/.exec(last);
    if (withPostal) {
      postal ??= withPostal[2];
      if (withPostal[1]) parts[parts.length - 1] = withPostal[1].trim();
      else parts.pop();
      continue;
    }
    const plain = norm(last.replace(PROVINCE_PREFIX, ''));
    if (plain === 'indonesia' || plain === norm(b.province)) {
      parts.pop();
      continue;
    }
    const city = CITY_PREFIX.exec(last);
    if (city) {
      locality ??= city[1].trim();
      parts.pop();
      continue;
    }
    if (norm(last) === norm(b.city)) {
      parts.pop();
      continue;
    }
    break;
  }

  return {
    ...(parts.length ? { streetAddress: parts.join(', ') } : {}),
    addressLocality: locality ?? b.city,
    addressRegion: b.province,
    ...(postal ? { postalCode: postal } : {}),
  };
}
