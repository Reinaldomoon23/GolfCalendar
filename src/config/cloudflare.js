/**
 * Cloudflare R2 Configuration
 *
 * Public configuration only. R2 credentials live exclusively in the serverless API.
 */

export const R2_CONFIG = {
  publicUrl: import.meta.env.VITE_R2_PUBLIC_URL
    || 'https://pub-23c281cf1ae04def9102341cf7d87837.r2.dev'
};
