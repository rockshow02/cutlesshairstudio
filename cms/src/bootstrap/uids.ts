/** UID content type tahap 1. Dipakai bersama oleh bootstrap (izin, role, label). */
export const UID = {
  pricing: 'api::pricing-item.pricing-item',
  barber: 'api::barber.barber',
  gallery: 'api::gallery-item.gallery-item',
  promo: 'api::promo.promo',
  announcement: 'api::announcement.announcement',
  settings: 'api::site-setting.site-setting',
} as const;

export type CmsUid = (typeof UID)[keyof typeof UID];

export const COLLECTION_UIDS: CmsUid[] = [UID.pricing, UID.barber, UID.gallery, UID.promo, UID.announcement];
export const SINGLE_UIDS: CmsUid[] = [UID.settings];
export const ALL_UIDS: CmsUid[] = [...COLLECTION_UIDS, ...SINGLE_UIDS];

export const OPENING_HOUR_COMPONENT = 'shared.opening-hour';
