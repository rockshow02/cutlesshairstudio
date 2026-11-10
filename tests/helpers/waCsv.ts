/**
 * Jumlah klik dari CSV /statistik/?format=csv (statsCsv di worker/stats.ts): menjumlahkan SEMUA baris yang cocok. CSV punya
 * satu baris per hari per kombinasi, jadi klik yang sama bisa tersebar di beberapa baris (mis. melewati tengah malam WIB);
 * membaca baris pertama saja membuat tes bergantung pada tanggal. Dipakai tes unit & e2e/wa-clicks.spec.ts.
 */
const BOM = String.fromCharCode(0xfeff);
export function clicksInCsv(csv: string, match: { kind: string; barber?: string; source?: string; day?: string }): number {
  const cell = /"((?:[^"]|"")*)"/g;
  let total = 0;
  for (const line of csv.replace(new RegExp(`^${BOM}`), '').split('\r\n').slice(1)) {
    const [day, kind, , barber, , source, clicks] = [...line.matchAll(cell)].map((m) => m[1].replace(/""/g, '"'));
    if (kind !== match.kind || (match.barber !== undefined && barber !== match.barber) || (match.source !== undefined && source !== match.source) || (match.day !== undefined && day !== match.day)) continue;
    total += Number(clicks) || 0;
  }
  return total;
}
