/**
 * Properti wajib Google (Rich Results) untuk Event: name, startDate, location dengan name + address. Dipakai tes unit
 * pipeline Kabar (tests/kabar-build.test.ts) dan e2e JSON-LD halaman Acara hasil build (e2e/kabar.spec.ts).
 */
export function requiredEventProps(ld: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (!ld.name) missing.push('name');
  if (!ld.startDate) missing.push('startDate');
  const locations = ([] as Record<string, unknown>[]).concat((ld.location ?? []) as Record<string, unknown>[]);
  if (!locations.length) missing.push('location');
  locations.forEach((l, i) => {
    if (!l.name) missing.push(`location[${i}].name`);
    if (!l.address) missing.push(`location[${i}].address`);
  });
  return missing;
}
