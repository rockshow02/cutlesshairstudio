export type SocialPlatform = 'instagram' | 'tiktok' | 'whatsapp' | 'google';

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  /** Mis. "@cutlesshairstudio" */
  handle: string;
  url: string;
}
