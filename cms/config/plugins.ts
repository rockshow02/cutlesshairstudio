import type { Core } from '@strapi/strapi';

/**
 * Upload media:
 * - Default (development): disimpan lokal di public/uploads.
 * - Production: isi CLOUDINARY_NAME, CLOUDINARY_KEY, CLOUDINARY_SECRET → otomatis pakai Cloudinary.
 */
const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const useCloudinary = Boolean(env('CLOUDINARY_NAME'));

  return {
    'users-permissions': {
      config: {
        jwtSecret: env('JWT_SECRET'),
      },
    },
    upload: {
      config: {
        sizeLimit: env.int('UPLOAD_SIZE_LIMIT', 10 * 1024 * 1024), // 10 MB
        breakpoints: { large: 1200, medium: 900, small: 600, thumbnail: 245 },
        ...(useCloudinary
          ? {
              provider: 'cloudinary',
              providerOptions: {
                cloud_name: env('CLOUDINARY_NAME'),
                api_key: env('CLOUDINARY_KEY'),
                api_secret: env('CLOUDINARY_SECRET'),
              },
              actionOptions: {
                upload: { folder: env('CLOUDINARY_FOLDER', 'cutless') },
                uploadStream: { folder: env('CLOUDINARY_FOLDER', 'cutless') },
                delete: {},
              },
            }
          : {}),
      },
    },
  };
};

export default config;
