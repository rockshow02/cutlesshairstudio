import type { Core } from '@strapi/strapi';

const config: Core.Config.Api = {
  rest: {
    defaultLimit: 50,
    maxLimit: 200,
    withCount: true,
  },
};

export default config;
