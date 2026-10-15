/**
 * Serializer query bergaya Strapi (bracket notation), pengganti library `qs`.
 * { filters: { isActive: { $eq: true } }, sort: ['order:asc'] }
 *   → filters[isActive][$eq]=true&sort[0]=order:asc
 */
type QueryValue = string | number | boolean | null | undefined | QueryValue[] | { [key: string]: QueryValue };

export type StrapiQuery = { [key: string]: QueryValue };

export function toQueryString(query: StrapiQuery): string {
  const parts: string[] = [];

  const walk = (value: QueryValue, prefix: string) => {
    if (value === undefined) return;
    if (value === null) {
      parts.push(`${encodeURIComponent(prefix)}=`);
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${prefix}[${i}]`));
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => walk(v, prefix ? `${prefix}[${k}]` : k));
    } else {
      parts.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
    }
  };

  walk(query, '');
  return parts.join('&');
}
