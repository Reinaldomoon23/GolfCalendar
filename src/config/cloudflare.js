/**
 * Cloudflare R2 Configuration
 *
 * Credentials are loaded from environment variables (.env.local or .env.production)
 * NEVER commit credentials directly in this file.
 */

import { S3Client } from "@aws-sdk/client-s3";

export const R2_CONFIG = {
  accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
  secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  bucketName: import.meta.env.VITE_R2_BUCKET_NAME,
  publicUrl: import.meta.env.VITE_R2_PUBLIC_URL
};

// Validate that credentials are loaded
if (import.meta.env.MODE === 'production' && !R2_CONFIG.accessKeyId) {
  console.error('❌ R2 credentials not found in environment variables');
}

export const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});
